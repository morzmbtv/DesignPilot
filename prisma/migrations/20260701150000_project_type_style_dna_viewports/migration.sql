ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'mobile_app',
  ADD COLUMN IF NOT EXISTS "viewportPreset" TEXT NOT NULL DEFAULT 'iphone_390x844',
  ADD COLUMN IF NOT EXISTS "customViewportWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "customViewportHeight" INTEGER,
  ADD COLUMN IF NOT EXISTS "styleDna" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "Screen"
  ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS "viewportPreset" TEXT NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS "customViewportWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "customViewportHeight" INTEGER;

UPDATE "Project" SET "platform" = 'ios' WHERE "platform" IN ('iOS', 'iOS и Android');
UPDATE "Project" SET "platform" = 'android' WHERE "platform" = 'Android';
ALTER TABLE "Project" ALTER COLUMN "platform" SET DEFAULT 'ios';
