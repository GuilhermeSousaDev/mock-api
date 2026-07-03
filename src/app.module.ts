import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TechStacksModule } from './modules/tech-stacks/tech-stacks.module';
import { AiModule } from './modules/ai/ai.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    // Global per-IP rate limit; payment endpoints tighten this further with
    // @Throttle to blunt card-testing abuse.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    InterviewsModule,
    QuestionsModule,
    FeedbackModule,
    SubscriptionsModule,
    TechStacksModule,
    AiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
