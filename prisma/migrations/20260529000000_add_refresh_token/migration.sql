-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "refreshToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_refreshToken_key" ON "usuarios"("refreshToken");
