/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Attachment` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `docxUrl` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedById` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fileKey` to the `Attachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `Upload` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_uploadedById_fkey";

-- AlterTable
ALTER TABLE "Attachment" DROP COLUMN "fileUrl",
ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "createdById",
DROP COLUMN "docxUrl",
ADD COLUMN     "createdByEmail" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "docxKey" TEXT;

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "fileUrl",
DROP COLUMN "uploadedById",
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "uploadedByEmail" TEXT,
ADD COLUMN     "uploadedByName" TEXT;

-- DropTable
DROP TABLE "User";
