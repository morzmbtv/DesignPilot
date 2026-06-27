CREATE TABLE "DesignDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "screenId" TEXT,
    "screenVersionId" TEXT,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DesignDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesignDecision_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DesignDecision_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ScreenSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "screenVersionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mainPurpose" TEXT NOT NULL,
    "primaryUserAction" TEXT,
    "usedPatterns" TEXT,
    "usedRules" TEXT,
    "visualNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScreenSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScreenSummary_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScreenSummary_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiPromptLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "screenId" TEXT,
    "screenVersionId" TEXT,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestPreview" TEXT NOT NULL,
    "fullPrompt" TEXT NOT NULL,
    "rawResponse" TEXT,
    "parsedResponse" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiPromptLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiPromptLog_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiPromptLog_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DesignDecision_projectId_status_idx" ON "DesignDecision"("projectId", "status");
CREATE INDEX "DesignDecision_screenId_idx" ON "DesignDecision"("screenId");
CREATE INDEX "DesignDecision_screenVersionId_idx" ON "DesignDecision"("screenVersionId");
CREATE UNIQUE INDEX "ScreenSummary_screenVersionId_key" ON "ScreenSummary"("screenVersionId");
CREATE INDEX "ScreenSummary_projectId_idx" ON "ScreenSummary"("projectId");
CREATE INDEX "ScreenSummary_screenId_idx" ON "ScreenSummary"("screenId");
CREATE INDEX "AiPromptLog_projectId_createdAt_idx" ON "AiPromptLog"("projectId", "createdAt");
CREATE INDEX "AiPromptLog_screenId_idx" ON "AiPromptLog"("screenId");
CREATE INDEX "AiPromptLog_screenVersionId_idx" ON "AiPromptLog"("screenVersionId");
