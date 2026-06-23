import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Plan } from '@prisma/client';
// `stripe` is a CommonJS `export =` module. This project does not enable
// `esModuleInterop`, so a default import emits `stripe_1.default` (undefined at
// runtime). The import-equals form binds the constructor itself and still
// exposes the `Stripe.*` type namespace.
import Stripe = require('stripe');

/**
 * Thin wrapper around the Stripe SDK. The whole subscription flow is driven
 * from the client with Stripe Elements and verified here in real time by
 * retrieving the PaymentIntent — there is no webhook in this integration.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe.Stripe;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    // No apiVersion pin: use the version the installed SDK ships with so the
    // types and runtime always agree.
    this.stripe = new Stripe(secretKey);
  }

  /** Publishable key handed to the browser so Stripe.js can be initialised. */
  get publishableKey(): string {
    return this.config.get<string>('stripe.publishableKey') ?? '';
  }

  /** Maps an app plan to its configured Stripe recurring price id. */
  priceIdForPlan(plan: Plan): string {
    const priceId =
      plan === Plan.PRO
        ? this.config.get<string>('stripe.proPriceId')
        : plan === Plan.PREMIUM
          ? this.config.get<string>('stripe.premiumPriceId')
          : undefined;

    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for plan ${plan}`);
    }
    return priceId;
  }

  /**
   * Returns a usable Stripe customer id for the user, reusing the stored one
   * when it still exists and creating a fresh customer otherwise.
   */
  async ensureCustomer(params: {
    existingId?: string | null;
    email: string;
    name: string;
    userId: string;
  }): Promise<string> {
    if (params.existingId) {
      try {
        const existing = await this.stripe.customers.retrieve(params.existingId);
        if (!existing.deleted) return existing.id;
      } catch {
        // Stored id no longer resolves (e.g. test data wiped) — recreate below.
        this.logger.warn(`Stripe customer ${params.existingId} not found; recreating`);
      }
    }

    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { userId: params.userId },
    });
    return customer.id;
  }

  /**
   * Creates a PaymentIntent for the plan's price. The amount and currency are
   * read from the Stripe price itself so it stays the single source of truth.
   */
  async createPaymentIntent(params: {
    customerId: string;
    plan: Plan;
    userId: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string; amount: number; currency: string }> {
    const priceId = this.priceIdForPlan(params.plan);
    const price = await this.stripe.prices.retrieve(priceId);
    if (!price.unit_amount) {
      throw new BadRequestException(`Stripe price ${priceId} has no fixed unit amount`);
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: price.unit_amount,
      currency: price.currency,
      customer: params.customerId,
      // Lets Stripe surface every payment method enabled in the dashboard via
      // the Payment Element, with cards always available.
      automatic_payment_methods: { enabled: true },
      metadata: { userId: params.userId, plan: params.plan, priceId },
    });

    if (!intent.client_secret) {
      throw new BadRequestException('Stripe did not return a client secret');
    }

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: price.unit_amount,
      currency: price.currency,
    };
  }

  /** Fetches the live PaymentIntent so its status can be verified server-side. */
  retrievePaymentIntent(id: string) {
    return this.stripe.paymentIntents.retrieve(id);
  }
}
