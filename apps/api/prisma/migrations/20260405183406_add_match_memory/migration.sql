-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "matchMethod" TEXT,
ADD COLUMN     "matchScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "InvoiceMatchMemory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "rawName" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceMatchMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceMatchMemory_userId_rawName_key" ON "InvoiceMatchMemory"("userId", "rawName");
