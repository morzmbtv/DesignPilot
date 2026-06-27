ALTER TABLE "ScreenVersion" ADD COLUMN "newRulesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Screen" ADD COLUMN "approvedVersionId" TEXT REFERENCES "ScreenVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Screen_approvedVersionId_key" ON "Screen"("approvedVersionId");
