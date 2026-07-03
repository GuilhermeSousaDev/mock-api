import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tight per-IP limits: registration spam and credential brute-force are the
  // two cheapest attacks against a public auth API.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Req() req: any, @Body() _dto: LoginDto) {
    return this.authService.login(req.user.id, req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
