import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TechStacksService } from './tech-stacks.service';

@ApiTags('tech-stacks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tech-stacks')
export class TechStacksController {
  constructor(private readonly techStacksService: TechStacksService) {}

  @Get()
  findAll() {
    return this.techStacksService.findAll();
  }
}
