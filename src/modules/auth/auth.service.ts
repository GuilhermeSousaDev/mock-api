import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

// Compared against when the email does not exist, so a login attempt costs
// the same bcrypt work either way — response timing must not reveal whether
// an account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-placeholder', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    return this.signToken(user.id, user.email);
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(userId: string, email: string) {
    return this.signToken(userId, email);
  }

  private signToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
    };
  }
}
