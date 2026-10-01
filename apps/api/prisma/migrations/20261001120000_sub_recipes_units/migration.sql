-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "isPreparation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "yieldQuantity" DECIMAL(65,30),
ADD COLUMN     "yieldUnit" TEXT;

-- AlterTable
ALTER TABLE "RecipeItem" ADD COLUMN     "subRecipeId" INTEGER,
ADD COLUMN     "unit" TEXT,
ALTER COLUMN "ingredientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "conversionFactor" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "InvoiceMatchMemory" ADD COLUMN     "conversionFactor" DECIMAL(65,30);

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Une ligne de recette pointe vers exactement une cible : un ingrédient OU une préparation.
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_one_target_check"
  CHECK (("ingredientId" IS NULL) <> ("subRecipeId" IS NULL));
