import { Module } from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InterviewsModule } from '../interviews/interviews.module';

@Module({
  imports: [SubscriptionsModule, InterviewsModule],
  providers: [RecordingsService],
  controllers: [RecordingsController],
  exports: [RecordingsService],
})
export class RecordingsModule {}
