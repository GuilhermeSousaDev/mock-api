import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/:interviewId/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  findOne(@Param('interviewId') interviewId: string) {
    return this.feedbackService.findByInterview(interviewId);
  }
}
