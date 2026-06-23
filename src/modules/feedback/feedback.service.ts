import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async findByInterview(interviewId: string) {
    const report = await this.prisma.feedbackReport.findUnique({ where: { interviewId } });
    if (!report) throw new NotFoundException('Feedback report not found');
    return report;
  }

  create(data: {
    interviewId: string;
    overallScore: number;
    topicBreakdown: object[];
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
    summary: string;
  }) {
    return this.prisma.feedbackReport.create({ data: data as any });
  }
}
