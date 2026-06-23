import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class UploadRecordingDto {
  /** Base64-encoded audio payload (no data-URL prefix). */
  @ApiProperty()
  @IsString()
  data!: string;

  @ApiProperty({ example: 'audio/webm' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Duration in seconds' })
  @IsInt()
  @Min(0)
  duration!: number;
}
