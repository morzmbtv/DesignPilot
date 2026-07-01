CREATE TABLE IF NOT EXISTS "ProjectAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'uploaded',
  "mimeType" TEXT NOT NULL,
  "fileName" TEXT,
  "fileSize" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "dataUrl" TEXT,
  "fileUrl" TEXT,
  "prompt" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "isPrimaryLogo" BOOLEAN NOT NULL DEFAULT false,
  "isBrandAsset" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectAsset_userId_idx" ON "ProjectAsset"("userId");
CREATE INDEX IF NOT EXISTS "ProjectAsset_projectId_type_idx" ON "ProjectAsset"("projectId", "type");
CREATE INDEX IF NOT EXISTS "ProjectAsset_projectId_isPrimaryLogo_idx" ON "ProjectAsset"("projectId", "isPrimaryLogo");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAsset_one_primary_logo_per_project"
  ON "ProjectAsset"("projectId") WHERE "isPrimaryLogo" = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAsset_userId_fkey'
  ) THEN
    ALTER TABLE "ProjectAsset"
      ADD CONSTRAINT "ProjectAsset_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAsset_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectAsset"
      ADD CONSTRAINT "ProjectAsset_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
