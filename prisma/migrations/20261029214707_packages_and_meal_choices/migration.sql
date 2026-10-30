-- AlterEnum
ALTER TYPE "DiscountType" ADD VALUE 'FIRST_WEEK_MEAL_PRICE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "planIsSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planMealsPerWeek" INTEGER;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "daysPerWeek" INTEGER,
ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mealsPerDay" INTEGER;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "personalWindowMinutes" INTEGER;

-- CreateTable
CREATE TABLE "OrderMealSelection" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "mealId" TEXT,
    "mealName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderMealSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderMealSelection_orderId_idx" ON "OrderMealSelection"("orderId");

-- CreateIndex
CREATE INDEX "OrderMealSelection_mealId_idx" ON "OrderMealSelection"("mealId");

-- AddForeignKey
ALTER TABLE "OrderMealSelection" ADD CONSTRAINT "OrderMealSelection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMealSelection" ADD CONSTRAINT "OrderMealSelection_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dish quantities are always positive.
ALTER TABLE "OrderMealSelection" ADD CONSTRAINT "OrderMealSelection_quantity_check" CHECK ("quantity" > 0);
