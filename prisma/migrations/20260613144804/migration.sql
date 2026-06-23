-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PENDING', 'WARMUP', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('WARMUP', 'TECHNICAL', 'FOLLOWUP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "interviewsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechStack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "iconUrl" TEXT,

    CONSTRAINT "TechStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "DifficultyLevel" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewTechStack" (
    "interviewId" TEXT NOT NULL,
    "techStackId" TEXT NOT NULL,

    CONSTRAINT "InterviewTechStack_pkey" PRIMARY KEY ("interviewId","techStackId")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "evaluation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "topicBreakdown" JSONB NOT NULL,
    "strengths" TEXT[],
    "improvements" TEXT[],
    "nextSteps" TEXT[],
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TechStack_name_key" ON "TechStack"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TechStack_slug_key" ON "TechStack"("slug");

-- CreateIndex
CREATE INDEX "Interview_userId_idx" ON "Interview"("userId");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE INDEX "Question_interviewId_idx" ON "Question"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionId_key" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackReport_interviewId_key" ON "FeedbackReport"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_interviewId_key" ON "Recording"("interviewId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTechStack" ADD CONSTRAINT "InterviewTechStack_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTechStack" ADD CONSTRAINT "InterviewTechStack_techStackId_fkey" FOREIGN KEY ("techStackId") REFERENCES "TechStack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
