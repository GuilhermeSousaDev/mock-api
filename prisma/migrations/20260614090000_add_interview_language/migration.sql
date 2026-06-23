-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'PT_BR');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN "language" "Language" NOT NULL DEFAULT 'EN';
