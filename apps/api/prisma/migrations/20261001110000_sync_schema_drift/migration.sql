-- Rattrapage d'un écart entre les migrations et le schéma.
--
-- Les tables TechSheet et Notification, et la suppression de Recipe.energyCost,
-- ont été appliquées en production par `prisma db push`, sans migration.
-- Une base neuve construite par `migrate deploy` n'avait donc ni fiches
-- techniques ni notifications.
--
-- Tout est idempotent : sur une base où ces changements existent déjà
-- (la production), cette migration ne fait rien.

ALTER TABLE "Recipe" DROP COLUMN IF EXISTS "energyCost";

CREATE TABLE IF NOT EXISTS "TechSheet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "recipeId" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "difficulty" TEXT,
    "ingredients" TEXT NOT NULL DEFAULT '[]',
    "steps" TEXT NOT NULL DEFAULT '[]',
    "presentation" TEXT,
    "tips" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TechSheet_userId_fkey') THEN
    ALTER TABLE "TechSheet" ADD CONSTRAINT "TechSheet_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
