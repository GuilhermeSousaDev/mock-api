import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InterviewStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({ enum: InterviewStatus })
  @IsEnum(InterviewStatus)
  status!: InterviewStatus;
}
