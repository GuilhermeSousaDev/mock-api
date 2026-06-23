import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TechStacksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.techStack.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }
}
