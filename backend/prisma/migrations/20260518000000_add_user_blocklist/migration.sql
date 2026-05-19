-- Add blocklist fields to User table
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "blockReason" TEXT;
ALTER TABLE "User" ADD COLUMN "blockedAt" DATETIME;
