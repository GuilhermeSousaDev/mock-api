import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput) {
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          subscription: { create: { plan: 'FREE' } },
        },
        include: { subscription: true },
      });
    } catch (err) {
      // Unique-constraint violation — relying on the DB (instead of a prior
      // findUnique check) keeps concurrent registrations from crashing as 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
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
