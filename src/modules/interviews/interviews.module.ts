import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { AiModule } from '../ai/ai.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [AiModule, SubscriptionsModule, FeedbackModule],
  providers: [InterviewsService],
  controllers: [InterviewsController],
  exports: [InterviewsService],
})
export class InterviewsModule {}
