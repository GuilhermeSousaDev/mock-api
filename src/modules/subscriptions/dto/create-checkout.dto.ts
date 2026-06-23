import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Plan } from '@prisma/client';

export class CreateCheckoutDto {
  @ApiProperty({ enum: Plan, description: 'Paid plan the user wants to subscribe to' })
  @IsEnum(Plan)
  plan!: Plan;
}
