import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
