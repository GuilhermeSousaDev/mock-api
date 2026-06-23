import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConfirmCheckoutDto {
  @ApiProperty({ description: 'Id of the PaymentIntent created during checkout' })
  @IsString()
  @Matches(/^pi_/, { message: 'paymentIntentId must be a Stripe PaymentIntent id' })
  paymentIntentId!: string;
}
