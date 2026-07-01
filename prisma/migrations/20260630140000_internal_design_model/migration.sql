CREATE TABLE IF NOT EXISTS "ScreenDesign" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "screenId" TEXT NOT NULL,
  "screenVersionId" TEXT NOT NULL,
  "modelJson" TEXT NOT NULL,
  "normalizedJson" TEXT,
  "validationJson" TEXT,
  "compilerVersion" TEXT NOT NULL DEFAULT 'idm-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScreenDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScreenDesign_screenVersionId_key" ON "ScreenDesign"("screenVersionId");
CREATE INDEX IF NOT EXISTS "ScreenDesign_projectId_idx" ON "ScreenDesign"("projectId");
CREATE INDEX IF NOT EXISTS "ScreenDesign_screenId_idx" ON "ScreenDesign"("screenId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScreenDesign_projectId_fkey'
  ) THEN
    ALTER TABLE "ScreenDesign"
      ADD CONSTRAINT "ScreenDesign_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScreenDesign_screenId_fkey'
  ) THEN
    ALTER TABLE "ScreenDesign"
      ADD CONSTRAINT "ScreenDesign_screenId_fkey"
      FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScreenDesign_screenVersionId_fkey'
  ) THEN
    ALTER TABLE "ScreenDesign"
      ADD CONSTRAINT "ScreenDesign_screenVersionId_fkey"
      FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
