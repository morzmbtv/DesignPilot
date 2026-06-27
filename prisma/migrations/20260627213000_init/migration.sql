PRAGMA foreign_keys=OFF;

CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "targetUsers" TEXT NOT NULL DEFAULT '',
    "appGoal" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'iOS и Android',
    "styleDirection" TEXT NOT NULL DEFAULT '',
    "designRequirements" TEXT NOT NULL DEFAULT '',
    "architectureNotes" TEXT NOT NULL DEFAULT '',
    "constraints" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ProjectRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Screen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Screen_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ScreenVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screenId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "userRequest" TEXT NOT NULL DEFAULT '',
    "designSpec" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL DEFAULT '',
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenVersion_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectRule_projectId_idx" ON "ProjectRule"("projectId");
CREATE INDEX "Screen_projectId_idx" ON "Screen"("projectId");
CREATE INDEX "ScreenVersion_screenId_idx" ON "ScreenVersion"("screenId");
CREATE UNIQUE INDEX "ScreenVersion_screenId_versionNumber_key" ON "ScreenVersion"("screenId", "versionNumber");

PRAGMA foreign_keys=ON;
