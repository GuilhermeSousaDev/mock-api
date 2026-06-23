import { DifficultyLevel, Language, QuestionType } from '@prisma/client';

export interface InterviewContext {
  level: DifficultyLevel;
  techStacks: string[];
  candidateName: string;
  language: Language;
}

export interface InterviewState {
  interviewId: string;
  level: DifficultyLevel;
  techStacks: string[];
  language: Language;
  priorQuestionsAndAnswers: Array<{
    question: string;
    answer: string;
    score?: number;
    /** Whether this exchange opened a topic (TECHNICAL/WARMUP) or probed one deeper (FOLLOWUP). */
    type?: QuestionType;
  }>;
  currentDifficulty: number;
  /** Consecutive follow-ups already asked on the current topic thread. */
  followUpDepth: number;
  /** Max follow-ups allowed per topic before the interviewer must move on. */
  maxFollowUps: number;
  /** Questions still to be asked (including the next one) before the interview ends. */
  questionsRemaining: number;
}

export interface Question {
  text: string;
  type: 'WARMUP' | 'TECHNICAL' | 'FOLLOWUP';
  difficulty: number;
  expectedTopics?: string[];
  /**
   * Brief spoken acknowledgment of the candidate's *previous* answer, delivered by
   * the interviewer just before this question. Empty for the first question.
   */
  feedback?: string;
}

export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestedNextDifficulty: number;
}

export interface TopicScore {
  topic: string;
  score: number;
  notes: string;
}

export interface FeedbackReport {
  overallScore: number;
  topicBreakdown: TopicScore[];
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  summary: string;
}

export interface ProviderHealth {
  ok: boolean;
  provider: string;
  model?: string;
  status?: number;
  message: string;
}

export interface AIProvider {
  generateWarmupQuestions(context: InterviewContext): Promise<Question[]>;
  generateNextQuestion(state: InterviewState): Promise<Question>;
  evaluateAnswer(question: string, answer: string, state: InterviewState): Promise<AnswerEvaluation>;
  generateFinalFeedback(state: InterviewState): Promise<FeedbackReport>;
  /**
   * Fix English technical terms a speech recognizer garbled in a dictated answer.
   * Best-effort: returns the original transcript unchanged if the provider fails.
   */
  normalizeTranscript(transcript: string, language: Language): Promise<string>;
  /** Lightweight connectivity + auth + model check for diagnostics. */
  healthCheck(): Promise<ProviderHealth>;
}
