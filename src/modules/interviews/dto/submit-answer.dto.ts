import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  transcript!: string;
}
