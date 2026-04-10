-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "energyCost" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "prepTimeMinutes" INTEGER,
ADD COLUMN     "servings" INTEGER DEFAULT 1,
ADD COLUMN     "wastagePercent" DECIMAL(65,30) DEFAULT 0;
