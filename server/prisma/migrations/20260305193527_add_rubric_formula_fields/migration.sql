/*
  Warnings:

  - Added the required column `updatedAt` to the `Rubric` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Rubric" ADD COLUMN     "baseRubric" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fixedValue" DECIMAL(65,30),
ADD COLUMN     "formula" TEXT,
ADD COLUMN     "percentage" DECIMAL(65,30),
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
