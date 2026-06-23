import { Module } from '@nestjs/common';
import { TechStacksService } from './tech-stacks.service';
import { TechStacksController } from './tech-stacks.controller';

@Module({
  providers: [TechStacksService],
  controllers: [TechStacksController],
  exports: [TechStacksService],
})
export class TechStacksModule {}
