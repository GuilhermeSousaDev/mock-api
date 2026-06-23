import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DifficultyLevel, InterviewStatus, Language, Plan, QuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FeedbackService } from '../feedback/feedback.service';
import { InterviewState } from '../ai/providers/ai-provider.interface';
import { MAX_QUESTION_COUNT, MIN_QUESTION_COUNT } from './dto/create-interview.dto';

/** Default total questions when the candidate doesn't choose. */
const DEFAULT_QUESTION_COUNT = 6;

/**
 * How many consecutive follow-ups the interviewer may ask on a single topic
 * before it must move on, so one thread can't swallow the whole question budget.
 */
const MAX_FOLLOWUPS_PER_TOPIC = 2;

/** Clamp a requested question count into the allowed range. */
function clampQuestionCount(value: number | undefined): number {
  if (value == null) return DEFAULT_QUESTION_COUNT;
  return Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, Math.round(value)));
}

const PLAN_MAX_TECH_STACKS: Record<Plan, number> = {
  FREE: 1,
  PRO: 3,
  PREMIUM: Number.MAX_SAFE_INTEGER,
};

const interviewInclude = {
  techStacks: { include: { techStack: true } },
  questions: { include: { answer: true }, orderBy: { order: 'asc' as const } },
  feedback: true,
  recording: true,
};

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly subscriptions: SubscriptionsService,
    private readonly feedback: FeedbackService,
  ) {}

  findAllByUser(userId: string) {
    return this.prisma.interview.findMany({
      where: { userId },
      include: {
        techStacks: { include: { techStack: true } },
        feedback: true,
        recording: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: interviewInclude,
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (userId && interview.userId !== userId) {
      throw new ForbiddenException('You do not have access to this interview');
    }
    return interview;
  }

  async create(
    userId: string,
    data: {
      level: DifficultyLevel;
      techStackIds: string[];
      language?: Language;
      questionCount?: number;
    },
  ) {
    const language = data.language ?? Language.EN;
    const questionCount = clampQuestionCount(data.questionCount);
    const { allowed, reason } = await this.subscriptions.canStartInterview(userId);
    if (!allowed) throw new ForbiddenException(reason ?? 'Cannot start interview');

    const sub = await this.subscriptions.getSubscription(userId);
    const maxStacks = PLAN_MAX_TECH_STACKS[sub?.plan ?? Plan.FREE];
    if (data.techStackIds.length > maxStacks) {
      throw new ForbiddenException(
        `Your plan allows up to ${maxStacks} tech stack(s) per interview`,
      );
    }

    const stacks = await this.prisma.techStack.findMany({
      where: { id: { in: data.techStackIds } },
    });
    if (stacks.length !== data.techStackIds.length) {
      throw new NotFoundException('One or more tech stacks were not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const interview = await this.prisma.interview.create({
      data: {
        userId,
        level: data.level,
        language,
        questionCount,
        status: InterviewStatus.PENDING,
        techStacks: {
          create: data.techStackIds.map((techStackId) => ({ techStackId })),
        },
      },
    });

    // Generate warm-up questions up front so the session can start immediately.
    const warmups = await this.ai.generateWarmupQuestions({
      level: data.level,
      techStacks: stacks.map((s) => s.name),
      candidateName: user?.name ?? 'there',
      language,
    });

    // Fall back to a default opener if the AI provider is unavailable, so the
    // session always has at least one question to start with.
    const stackList = stacks.map((s) => s.name).join(', ');
    const fallbackOpener =
      language === Language.PT_BR
        ? `Para começar, conte sobre sua experiência com ${stackList}.`
        : `To start, tell me about your experience with ${stackList}.`;
    const openers = warmups.length > 0 ? warmups : [{ text: fallbackOpener, difficulty: 0.1 }];

    await this.prisma.question.createMany({
      data: openers.map((q, i) => ({
        interviewId: interview.id,
        type: QuestionType.WARMUP,
        text: q.text,
        difficulty: q.difficulty,
        order: i,
      })),
    });

    await this.subscriptions.incrementInterviewCount(userId);

    return this.findOne(interview.id, userId);
  }

  async updateStatus(id: string, userId: string, status: InterviewStatus) {
    const interview = await this.findOne(id, userId);

    const patch: { status: InterviewStatus; startedAt?: Date; endedAt?: Date } = {
      status,
    };
    if (
      (status === InterviewStatus.WARMUP || status === InterviewStatus.IN_PROGRESS) &&
      !interview.startedAt
    ) {
      patch.startedAt = new Date();
    }
    if (status === InterviewStatus.COMPLETED || status === InterviewStatus.ABANDONED) {
      patch.endedAt = new Date();
    }

    await this.prisma.interview.update({ where: { id }, data: patch });

    if (status === InterviewStatus.COMPLETED) {
      await this.generateFeedback(id);
    }

    return this.findOne(id, userId);
  }

  /**
   * Persist + evaluate an answer, then return the next question (or null when
   * the interview has reached its question budget).
   */
  async submitAnswer(id: string, userId: string, questionId: string, transcript: string) {
    const interview = await this.findOne(id, userId);
    const question = interview.questions.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException('Question not found for this interview');

    const state = this.buildState(interview);

    // Repair technical terms the speech recognizer garbled before the answer is
    // evaluated or stored, so scoring and feedback see the candidate's real words.
    const cleanedTranscript = await this.ai.normalizeTranscript(transcript, interview.language);

    const evaluation = await this.ai.evaluateAnswer(question.text, cleanedTranscript, state);

    await this.prisma.answer.upsert({
      where: { questionId },
      create: {
        questionId,
        transcript: cleanedTranscript,
        score: evaluation.score,
        evaluation: evaluation as object,
      },
      update: {
        transcript: cleanedTranscript,
        score: evaluation.score,
        evaluation: evaluation as object,
      },
    });

    const answeredCount =
      interview.questions.filter((q) => q.answer).length + (question.answer ? 0 : 1);

    if (answeredCount >= interview.questionCount) {
      // The interview is over: send a short spoken sign-off from the interviewer,
      // read aloud client-side as the candidate's final answer is acknowledged,
      // just before the feedback report is shown.
      const closing =
        interview.language === Language.PT_BR
          ? 'É isso! Muito obrigado pelas suas respostas — com isso encerramos nossa entrevista. Vou preparar seu feedback agora.'
          : "That's everything I wanted to cover. Thank you for your answers — that wraps up our interview. I'll put your feedback together now.";
      return { evaluation, nextQuestion: null, feedback: '', closing, done: true };
    }

    // Depth of the current topic thread, counting the answer just submitted:
    // trailing consecutive follow-ups tell the interviewer whether it may keep
    // probing the same topic or must move on to a fresh one.
    const answeredInOrder = interview.questions.filter((q) => q.answer || q.id === questionId);
    let followUpDepth = 0;
    for (let i = answeredInOrder.length - 1; i >= 0; i--) {
      if (answeredInOrder[i].type === QuestionType.FOLLOWUP) followUpDepth++;
      else break;
    }

    const nextState: InterviewState = {
      ...state,
      currentDifficulty: evaluation.suggestedNextDifficulty,
      priorQuestionsAndAnswers: [
        ...state.priorQuestionsAndAnswers,
        {
          question: question.text,
          answer: cleanedTranscript,
          score: evaluation.score,
          type: question.type,
        },
      ],
      followUpDepth,
      maxFollowUps: MAX_FOLLOWUPS_PER_TOPIC,
      questionsRemaining: interview.questionCount - answeredCount,
    };

    const next = await this.ai.generateNextQuestion(nextState);

    // Honor the model's choice to probe deeper vs. move on, but enforce the
    // per-topic follow-up cap deterministically so one thread can't run away.
    const nextType =
      next.type === 'FOLLOWUP' && followUpDepth < MAX_FOLLOWUPS_PER_TOPIC
        ? QuestionType.FOLLOWUP
        : QuestionType.TECHNICAL;

    const created = await this.prisma.question.create({
      data: {
        interviewId: id,
        type: nextType,
        text: next.text,
        difficulty: next.difficulty,
        order: interview.questions.length,
      },
    });

    // `feedback` is a brief spoken acknowledgment of the answer just given,
    // delivered as a transition before the next question. It's ephemeral (read
    // aloud client-side), so it rides on the response rather than being persisted.
    return { evaluation, nextQuestion: created, feedback: next.feedback ?? '', done: false };
  }

  async generateFeedback(id: string) {
    const existing = await this.prisma.feedbackReport.findUnique({
      where: { interviewId: id },
    });
    if (existing) return existing;

    const interview = await this.findOne(id);
    const report = await this.ai.generateFinalFeedback(this.buildState(interview));

    return this.feedback.create({
      interviewId: id,
      overallScore: report.overallScore,
      topicBreakdown: report.topicBreakdown,
      strengths: report.strengths,
      improvements: report.improvements,
      nextSteps: report.nextSteps,
      summary: report.summary,
    });
  }

  private buildState(interview: Awaited<ReturnType<InterviewsService['findOne']>>): InterviewState {
    const answered = interview.questions.filter((q) => q.answer);
    let followUpDepth = 0;
    for (let i = answered.length - 1; i >= 0; i--) {
      if (answered[i].type === QuestionType.FOLLOWUP) followUpDepth++;
      else break;
    }
    return {
      interviewId: interview.id,
      level: interview.level,
      language: interview.language,
      techStacks: interview.techStacks.map((t) => t.techStack.name),
      priorQuestionsAndAnswers: answered.map((q) => ({
        question: q.text,
        answer: q.answer!.transcript,
        score: q.answer!.score ?? undefined,
        type: q.type,
      })),
      currentDifficulty: answered[answered.length - 1]?.difficulty ?? 0.3,
      followUpDepth,
      maxFollowUps: MAX_FOLLOWUPS_PER_TOPIC,
      questionsRemaining: Math.max(0, interview.questionCount - answered.length),
    };
  }
}
