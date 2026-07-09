/*
  Warnings:

  - A unique constraint covering the columns `[lastPaymentIntentId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastPaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_lastPaymentIntentId_key" ON "Subscription"("lastPaymentIntentId");
