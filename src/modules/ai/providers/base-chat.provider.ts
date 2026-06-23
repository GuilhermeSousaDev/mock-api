import {
  AIProvider,
  InterviewContext,
  InterviewState,
  Question,
  AnswerEvaluation,
  FeedbackReport,
  ProviderHealth,
} from './ai-provider.interface';
import { Language } from '@prisma/client';
import {
  INTERVIEWER_PERSONA,
  buildLevelGuidance,
  buildLanguageGuidance,
  buildProbingGuidance,
  buildTranscriptNormalizationPrompt,
  sanitizeNormalizedTranscript,
} from '../prompts/interviewer.prompts';

/** Human-readable explanation for a non-2xx HTTP status from a provider. */
export function describeHttpStatus(status: number, fallback: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Authentication failed — check the API key.';
    case 404:
      return 'Model or endpoint not found — check the model id and base URL.';
    case 429:
      return 'Rate limited — the free-tier quota is likely exhausted.';
    default:
      return status >= 500 ? 'Provider server error — try again later.' : fallback;
  }
}

/**
 * Shared prompt-building + JSON parsing for chat-style providers (local Ollama,
 * remote OpenAI-compatible endpoints). Subclasses implement only `chat()` — the
 * single HTTP call that turns a prompt into raw text. Any failure returns the
 * canned fallback so the interview flow never breaks during testing.
 */
export abstract class BaseChatProvider implements AIProvider {
  /** Send one prompt, return the model's raw text reply, or null on failure. */
  protected abstract chat(prompt: string): Promise<string | null>;

  /** Connectivity + auth + model diagnostic (provider-specific). */
  abstract healthCheck(): Promise<ProviderHealth>;

  async generateWarmupQuestions(context: InterviewContext): Promise<Question[]> {
    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(context.language)}

Generate 2-3 warm-up questions for a ${context.level} candidate interested in: ${context.techStacks.join(', ')}.
Return only a JSON array: [{ "text": string, "type": "WARMUP", "difficulty": 0.1 }]`;

    return this.run<Question[]>(prompt, []);
  }

  async generateNextQuestion(state: InterviewState): Promise<Question> {
    const history = state.priorQuestionsAndAnswers
      .map(
        (qa, i) =>
          `Q${i + 1} [${qa.type ?? 'TECHNICAL'}]: ${qa.question}\nA${i + 1}: ${qa.answer}\nScore: ${qa.score ?? 'N/A'}`,
      )
      .join('\n\n');

    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}
${buildLevelGuidance(state.level)}

Tech stacks: ${state.techStacks.join(', ')} | Current difficulty (0-1): ${state.currentDifficulty}
Interview so far:
${history || 'No questions asked yet.'}

${buildProbingGuidance(state.followUpDepth, state.maxFollowUps, state.questionsRemaining)}

First, in "feedback", give one or two sentences of brief, encouraging spoken feedback on the candidate's most recent answer — acknowledge what was good and, if relevant, what was missing. This is read aloud as a natural transition, so keep it conversational. If no questions have been answered yet, return an empty string.
Then generate the next question following the guidance above, adjusting difficulty to performance.
Return a single JSON object: { "feedback": string, "text": string, "type": "TECHNICAL" | "FOLLOWUP", "difficulty": number, "expectedTopics": string[] }`;

    return this.run<Question>(prompt, {
      feedback: '',
      text: 'Walk me through your most challenging technical project.',
      type: 'TECHNICAL',
      difficulty: 0.5,
      expectedTopics: [],
    });
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    state: InterviewState,
  ): Promise<AnswerEvaluation> {
    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}
${buildLevelGuidance(state.level)}

Evaluate this answer from a ${state.level} candidate.
Question: "${question}"
Answer: "${answer}"

Return JSON: { "score": number, "strengths": string[], "gaps": string[], "suggestedNextDifficulty": number }`;

    return this.run<AnswerEvaluation>(prompt, {
      score: 0.5,
      strengths: [],
      gaps: [],
      suggestedNextDifficulty: state.currentDifficulty,
    });
  }

  async generateFinalFeedback(state: InterviewState): Promise<FeedbackReport> {
    const history = state.priorQuestionsAndAnswers
      .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
      .join('\n\n');

    const prompt = `${INTERVIEWER_PERSONA}
${buildLanguageGuidance(state.language)}

Generate a feedback report for a ${state.level} candidate on ${state.techStacks.join(', ')}.
Interview transcript:
${history}

All scores ("overallScore" and each topic "score") are on a 0–10 scale (0 = no understanding, 10 = excellent).
Return JSON: { "overallScore": number, "topicBreakdown": [{ "topic": string, "score": number, "notes": string }], "strengths": string[], "improvements": string[], "nextSteps": string[], "summary": string }`;

    return this.run<FeedbackReport>(prompt, {
      overallScore: 0,
      topicBreakdown: [],
      strengths: [],
      improvements: [],
      nextSteps: [],
      summary: 'Interview completed.',
    });
  }

  async normalizeTranscript(transcript: string, language: Language): Promise<string> {
    const text = transcript.trim();
    if (!text) return transcript;
    const cleaned = await this.chat(buildTranscriptNormalizationPrompt(text, language));
    return sanitizeNormalizedTranscript(cleaned, transcript);
  }

  /** Run a prompt and leniently extract the first JSON object/array from the reply. */
  protected async run<T>(prompt: string, fallback: T): Promise<T> {
    const content = await this.chat(prompt);
    if (!content) return fallback;
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) return fallback;
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      return fallback;
    }
  }
}
