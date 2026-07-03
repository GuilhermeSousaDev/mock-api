import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class ConfirmCheckoutDto {
  @ApiProperty({ description: 'Id of the PaymentIntent created during checkout' })
  @IsString()
  @MaxLength(255)
  @Matches(/^pi_[A-Za-z0-9]+$/, {
    message: 'paymentIntentId must be a Stripe PaymentIntent id',
  })
  paymentIntentId!: string;
}
