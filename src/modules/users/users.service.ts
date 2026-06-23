import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const user = await this.prisma.user.create({
      data: {
        ...data,
        subscription: { create: { plan: 'FREE' } },
      },
      include: { subscription: true },
    });
    return user;
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { subscription: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
