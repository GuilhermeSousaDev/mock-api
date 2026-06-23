import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RecordingsService } from './recordings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InterviewsService } from '../interviews/interviews.service';
import { UploadRecordingDto } from './dto/upload-recording.dto';

@ApiTags('recordings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews/:interviewId/recording')
export class RecordingsController {
  constructor(
    private readonly recordingsService: RecordingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly interviews: InterviewsService,
  ) {}

  @Get()
  async findOne(
    @CurrentUser() user: any,
    @Param('interviewId') interviewId: string,
  ) {
    await this.interviews.findOne(interviewId, user.id);
    return this.recordingsService.findByInterview(interviewId);
  }

  @Post()
  async upload(
    @CurrentUser() user: any,
    @Param('interviewId') interviewId: string,
    @Body() dto: UploadRecordingDto,
  ) {
    await this.interviews.findOne(interviewId, user.id);

    const canRecord = await this.subscriptions.canRecordInterview(user.id);
    if (!canRecord) {
      throw new ForbiddenException('Recording is available on Pro and Premium plans');
    }

    return this.recordingsService.upload(interviewId, dto);
  }

  @Get('download')
  async download(
    @CurrentUser() user: any,
    @Param('interviewId') interviewId: string,
    @Res() res: Response,
  ) {
    await this.interviews.findOne(interviewId, user.id);

    const { recording, stream } = await this.recordingsService.getDownloadStream(interviewId);
    res.set({
      'Content-Type': recording.mimeType,
      'Content-Disposition': `attachment; filename="interview-${interviewId}.${recording.mimeType.split('/')[1] ?? 'webm'}"`,
    });
    stream.pipe(res);
  }
}
