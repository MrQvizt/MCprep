-- The daily streak and rewards scheme was dropped (owner decision); customer accounts stay.
-- These tables were empty when removed.

-- DropForeignKey
ALTER TABLE "CustomerCheckIn" DROP CONSTRAINT "CustomerCheckIn_accountId_fkey";

-- DropForeignKey
ALTER TABLE "RewardLedgerEntry" DROP CONSTRAINT "RewardLedgerEntry_accountId_fkey";

-- DropForeignKey
ALTER TABLE "RewardRedemption" DROP CONSTRAINT "RewardRedemption_accountId_fkey";

-- DropForeignKey
ALTER TABLE "RewardRedemption" DROP CONSTRAINT "RewardRedemption_orderId_fkey";

-- DropIndex
DROP INDEX "CustomerAccount_lastCheckInDay_idx";

-- AlterTable
ALTER TABLE "CustomerAccount" DROP COLUMN "currentStreak",
DROP COLUMN "lastCheckInDay",
DROP COLUMN "longestStreak",
DROP COLUMN "pointsBalance";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "rewardDiscountCents",
DROP COLUMN "rewardName";

-- DropTable
DROP TABLE "CustomerCheckIn";

-- DropTable
DROP TABLE "RewardLedgerEntry";

-- DropTable
DROP TABLE "RewardRedemption";

-- DropEnum
DROP TYPE "RewardEntryType";

-- DropEnum
DROP TYPE "RewardRedemptionStatus";

