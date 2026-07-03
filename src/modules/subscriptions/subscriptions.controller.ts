import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  getMySubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  /** Stripe publishable key for initialising Stripe.js in the browser. */
  @Get('stripe-config')
  getStripeConfig() {
    return this.subscriptionsService.getStripeConfig();
  }

  /** Starts a Stripe Elements checkout: returns a PaymentIntent client secret. */
  // Tight limit: every call creates a Stripe PaymentIntent, a favourite
  // primitive for card-testing abuse.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('checkout')
  createCheckout(@CurrentUser() user: any, @Body() dto: CreateCheckoutDto) {
    return this.subscriptionsService.createCheckout(user.id, dto.plan);
  }

  /** Verifies the payment with Stripe and, if succeeded, upgrades the plan. */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('confirm')
  confirmCheckout(@CurrentUser() user: any, @Body() dto: ConfirmCheckoutDto) {
    return this.subscriptionsService.confirmCheckout(user.id, dto.paymentIntentId);
  }

  /** Downgrade to FREE (paid plans are purchased via /checkout). */
  @Post('change')
  changePlan(@CurrentUser() user: any, @Body() dto: ChangePlanDto) {
    return this.subscriptionsService.changePlan(user.id, dto.plan);
  }
}
