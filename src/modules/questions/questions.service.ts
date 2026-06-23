import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  createQuestion(data: {
    interviewId: string;
    type: string;
    text: string;
    difficulty: number;
    order: number;
  }) {
    return this.prisma.question.create({ data: data as any });
  }

  createAnswer(questionId: string, transcript: string) {
    return this.prisma.answer.create({ data: { questionId, transcript } });
  }

  updateAnswerEvaluation(questionId: string, score: number, evaluation: object) {
    return this.prisma.answer.update({
      where: { questionId },
      data: { score, evaluation },
    });
  }
}
