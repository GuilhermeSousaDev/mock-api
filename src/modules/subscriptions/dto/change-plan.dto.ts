import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Plan } from '@prisma/client';

export class ChangePlanDto {
  @ApiProperty({ enum: Plan })
  @IsEnum(Plan)
  plan!: Plan;
}
