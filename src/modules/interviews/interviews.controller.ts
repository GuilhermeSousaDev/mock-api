import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.interviewsService.findAllByUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.findOne(id, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.interviewsService.updateStatus(id, user.id, dto.status);
  }

  @Post(':id/answers')
  submitAnswer(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.interviewsService.submitAnswer(id, user.id, dto.questionId, dto.transcript);
  }
}
