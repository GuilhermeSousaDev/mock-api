import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DifficultyLevel, Language } from '@prisma/client';

/** Bounds for the candidate-chosen number of questions per interview. */
export const MIN_QUESTION_COUNT = 5;
export const MAX_QUESTION_COUNT = 15;

export class CreateInterviewDto {
  @ApiProperty({ enum: DifficultyLevel })
  @IsEnum(DifficultyLevel)
  level!: DifficultyLevel;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  techStackIds!: string[];

  @ApiPropertyOptional({ enum: Language, default: Language.EN })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({
    minimum: MIN_QUESTION_COUNT,
    maximum: MAX_QUESTION_COUNT,
    default: 6,
    description: 'How many questions the interview should ask (5–15).',
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_QUESTION_COUNT)
  @Max(MAX_QUESTION_COUNT)
  questionCount?: number;
}
