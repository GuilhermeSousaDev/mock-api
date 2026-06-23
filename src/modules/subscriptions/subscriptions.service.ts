import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Plan } from '@prisma/client';
import { StripeService } from './stripe.service';

const PLAN_LIMITS = {
  FREE: { interviewsPerMonth: 3, maxTechStacks: 1 },
  PRO: { interviewsPerMonth: Infinity, maxTechStacks: 3 },
  PREMIUM: { interviewsPerMonth: Infinity, maxTechStacks: Infinity },
} as const;

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async getSubscription(userId: string) {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  /** Publishable key + the user's current customer id for the browser. */
  getStripeConfig() {
    return { publishableKey: this.stripe.publishableKey };
  }

  /**
   * Step 1 of the Stripe Elements flow: create a PaymentIntent for the chosen
   * paid plan and return its client secret so the browser can collect and
   * confirm the card. No plan change happens yet — only a successful payment
   * (verified in {@link confirmCheckout}) upgrades the account.
   */
  async createCheckout(userId: string, plan: Plan) {
    if (plan === Plan.FREE) {
      throw new BadRequestException('The FREE plan does not require a payment');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.stripe.ensureCustomer({
      existingId: user.subscription?.stripeCustomerId,
      email: user.email,
      name: user.name,
      userId,
    });

    // Persist the customer id immediately so retries reuse the same customer.
    if (user.subscription?.stripeCustomerId !== customerId) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const intent = await this.stripe.createPaymentIntent({ customerId, plan, userId });
    return {
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      plan,
      amount: intent.amount,
      currency: intent.currency,
      publishableKey: this.stripe.publishableKey,
    };
  }

  /**
   * Step 2 of the Stripe Elements flow: after the browser confirms the card,
   * re-read the PaymentIntent straight from Stripe and only upgrade the plan
   * once Stripe itself reports the payment as `succeeded`. This is the
   * webhook-free, real-time verification — the client's word is never trusted.
   */
  async confirmCheckout(userId: string, paymentIntentId: string) {
    const intent = await this.stripe.retrievePaymentIntent(paymentIntentId);

    if (intent.metadata?.userId !== userId) {
      throw new BadRequestException('This payment does not belong to the current user');
    }
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed (status: ${intent.status})`);
    }

    const plan = intent.metadata?.plan as Plan | undefined;
    if (!plan || !(plan in PLAN_LIMITS) || plan === Plan.FREE) {
      throw new BadRequestException('Payment is missing a valid paid plan');
    }

    const now = new Date();
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        interviewsUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + PERIOD_MS),
        stripeCustomerId:
          typeof intent.customer === 'string' ? intent.customer : undefined,
      },
    });
  }

  /**
   * Downgrades to FREE. Upgrades to a paid plan must go through the Stripe
   * Elements checkout ({@link createCheckout} / {@link confirmCheckout}).
   */
  async changePlan(userId: string, plan: Plan) {
    if (plan !== Plan.FREE) {
      throw new BadRequestException('Paid plans must be purchased through Stripe checkout');
    }

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        plan: Plan.FREE,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        stripeSubscriptionId: null,
      },
    });
  }

  async canStartInterview(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.getSubscription(userId);
    if (!sub) return { allowed: false, reason: 'No subscription found' };

    const limits = PLAN_LIMITS[sub.plan];
    if (sub.interviewsUsed >= limits.interviewsPerMonth) {
      return { allowed: false, reason: 'Monthly interview limit reached' };
    }
    return { allowed: true };
  }

  async canRecordInterview(userId: string): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    return sub?.plan === Plan.PRO || sub?.plan === Plan.PREMIUM;
  }

  async incrementInterviewCount(userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: { interviewsUsed: { increment: 1 } },
    });
  }

  async getPlanLimits(plan: Plan) {
    return PLAN_LIMITS[plan];
  }
}
