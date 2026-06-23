import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  InterviewContext,
  InterviewState,
  Question,
  AnswerEvaluation,
  FeedbackReport,
  ProviderHealth,
} from './ai-provider.interface';
import {
  INTERVIEWER_PERSONA,
  buildLevelGuidance,
  buildLanguageGuidance,
  buildProbingGuidance,
  buildTranscriptNormalizationPrompt,
  sanitizeNormalizedTranscript,
} from '../prompts/interviewer.prompts';

@Injectable()
export class ClaudeProvider implements AIProvider {
  private readonly client: Anthropic;
  /** Cheap, high-volume calls (warm-ups, per-answer evaluation). */
  private readonly fastModel: string;
  /** Capable calls where quality matters most (next question, final feedback). */
  private readonly smartModel: string;
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor(config: ConfigService) {
    this.client = new Anthropic({ apiKey: config.get<string>('ai.claudeApiKey') });
    this.fastModel = config.get<string>('ai.fastModel') ?? 'claude-haiku-4-5';
    this.smartModel = config.get<string>('ai.smartModel') ?? 'claude-opus-4-8';
  }

  async generateWarmupQuestions(context: InterviewContext): Promise<Question[]> {
    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(context.language)}

Generate 2-3 warm-up questions for a ${context.level} candidate interested in: ${context.techStacks.join(', ')}.
Return only a JSON array: [{ "text": string, "type": "WARMUP", "difficulty": 0.1 }]`;

    return this.callAndParse<Question[]>(prompt, [], this.fastModel);
  }

  async generateNextQuestion(state: InterviewState): Promise<Question> {
    const levelGuidance = buildLevelGuidance(state.level);
    const last = state.priorQuestionsAndAnswers[state.priorQuestionsAndAnswers.length - 1];
    const lastExchange = last
      ? `The candidate just answered a ${last.type ?? 'TECHNICAL'} question on the current topic.
Previous question: "${last.question}"
Their answer: "${last.answer}"`
      : 'This is the first question — there is no previous answer.';

    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}
${levelGuidance}

Tech: ${state.techStacks.join(', ')} | Current difficulty: ${state.currentDifficulty}
Prior Q&A count: ${state.priorQuestionsAndAnswers.length}
${lastExchange}

${buildProbingGuidance(state.followUpDepth, state.maxFollowUps, state.questionsRemaining)}

First, in "feedback", give one or two sentences of brief, encouraging spoken feedback on the candidate's previous answer — acknowledge what was good and, if relevant, what was missing. This is read aloud as a natural transition, so keep it conversational. If there is no previous answer, return an empty string.
Then generate the next question following the guidance above, adjusting difficulty to their performance.
Return: { "feedback": string, "text": string, "type": "TECHNICAL" | "FOLLOWUP", "difficulty": number, "expectedTopics": string[] }`;

    return this.callAndParse<Question>(
      prompt,
      {
        feedback: '',
        text: 'Walk me through your most challenging technical project.',
        type: 'TECHNICAL',
        difficulty: 0.5,
        expectedTopics: [],
      },
      this.smartModel,
    );
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    state: InterviewState,
  ): Promise<AnswerEvaluation> {
    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}
${buildLevelGuidance(state.level)}

Evaluate: Question: "${question}" | Answer: "${answer}"
Candidate level: ${state.level}

Return: { "score": number, "strengths": string[], "gaps": string[], "suggestedNextDifficulty": number }`;

    return this.callAndParse<AnswerEvaluation>(
      prompt,
      {
        score: 0.5,
        strengths: [],
        gaps: [],
        suggestedNextDifficulty: state.currentDifficulty,
      },
      this.fastModel,
    );
  }

  async generateFinalFeedback(state: InterviewState): Promise<FeedbackReport> {
    const history = state.priorQuestionsAndAnswers
      .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n');

    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}

Generate feedback for a ${state.level} candidate on ${state.techStacks.join(', ')}.
Interview: ${history}

All scores ("overallScore" and each topic "score") are on a 0–10 scale (0 = no understanding, 10 = excellent).
Return: { "overallScore": number, "topicBreakdown": [{topic,score,notes}], "strengths": string[], "improvements": string[], "nextSteps": string[], "summary": string }`;

    return this.callAndParse<FeedbackReport>(
      prompt,
      {
        overallScore: 0,
        topicBreakdown: [],
        strengths: [],
        improvements: [],
        nextSteps: [],
        summary: 'Interview completed.',
      },
      this.smartModel,
    );
  }

  async normalizeTranscript(transcript: string, language: Language): Promise<string> {
    const text = transcript.trim();
    if (!text) return transcript;
    try {
      // A cheap, deterministic cleanup — the fast model is plenty, and adaptive
      // thinking is unnecessary for restoring mis-heard term spellings. max_tokens
      // sized to comfortably hold a multi-paragraph spoken answer without truncating.
      const response = await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 4096,
        messages: [
          { role: 'user', content: buildTranscriptNormalizationPrompt(text, language) },
        ],
      });
      const block = response.content[0];
      return sanitizeNormalizedTranscript(
        block.type === 'text' ? block.text : null,
        transcript,
      );
    } catch (err) {
      this.logger.error('Claude transcript normalization failed', err);
      return transcript;
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const base = { provider: 'claude', model: this.fastModel };
    try {
      await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { ...base, ok: true, status: 200, message: 'Connected.' };
    } catch (err) {
      const status = (err as { status?: number }).status;
      let message: string;
      if (status === 401) message = 'Invalid or missing ANTHROPIC_API_KEY.';
      else if (status === 404) message = `Model "${this.fastModel}" not found.`;
      else if (status === 429) message = 'Rate limited or out of credits.';
      else message = (err as Error).message ?? 'Claude request failed.';
      return { ...base, ok: false, status, message };
    }
  }

  private async callAndParse<T>(prompt: string, fallback: T, model: string): Promise<T> {
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content[0];
      if (block.type !== 'text') return fallback;

      const jsonMatch = block.text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) return fallback;
      return JSON.parse(jsonMatch[0]) as T;
    } catch (err) {
      this.logger.error('Claude call failed', err);
      return fallback;
    }
  }
}
