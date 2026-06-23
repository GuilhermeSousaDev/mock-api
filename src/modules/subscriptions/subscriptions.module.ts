import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeService } from './stripe.service';

@Module({
  providers: [SubscriptionsService, StripeService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
