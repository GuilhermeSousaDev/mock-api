import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  @Get('me')
  getMe(@CurrentUser() user: any) {
    // req.user already carries the sanitized user (with subscription) loaded
    // by JwtStrategy — re-fetching via findById would leak passwordHash.
    return user;
  }
}
