import { Inject, Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { AI_PROVIDER } from './ai.constants';
import {
  AIProvider,
  InterviewContext,
  InterviewState,
} from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AIProvider) {}

  generateWarmupQuestions(context: InterviewContext) {
    return this.provider.generateWarmupQuestions(context);
  }

  generateNextQuestion(state: InterviewState) {
    return this.provider.generateNextQuestion(state);
  }

  evaluateAnswer(question: string, answer: string, state: InterviewState) {
    return this.provider.evaluateAnswer(question, answer, state);
  }

  normalizeTranscript(transcript: string, language: Language) {
    return this.provider.normalizeTranscript(transcript, language);
  }

  generateFinalFeedback(state: InterviewState) {
    return this.provider.generateFinalFeedback(state);
  }

  healthCheck() {
    return this.provider.healthCheck();
  }
}
