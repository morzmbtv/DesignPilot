-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "targetUsers" TEXT NOT NULL DEFAULT '',
    "appGoal" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'iOS и Android',
    "styleDirection" TEXT NOT NULL DEFAULT '',
    "designRequirements" TEXT NOT NULL DEFAULT '',
    "architectureNotes" TEXT NOT NULL DEFAULT '',
    "constraints" TEXT NOT NULL DEFAULT '',
    "designSystemSource" TEXT NOT NULL DEFAULT 'current_library',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "approvedVersionId" TEXT,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenVersion" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "userRequest" TEXT NOT NULL DEFAULT '',
    "designSpec" TEXT NOT NULL DEFAULT '',
    "imagePrompt" TEXT NOT NULL DEFAULT '',
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "diff" TEXT NOT NULL DEFAULT '',
    "newRulesJson" TEXT NOT NULL DEFAULT '[]',
    "layoutJson" TEXT,
    "htmlLayout" TEXT,
    "flutterWidgetTree" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignComponent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Misc',
    "screenshot" TEXT,
    "preview" TEXT,
    "layoutJson" TEXT,
    "htmlLayout" TEXT,
    "flutterWidgetTree" TEXT,
    "dimensions" TEXT,
    "radius" TEXT,
    "colors" TEXT,
    "typography" TEXT,
    "spacing" TEXT,
    "states" TEXT,
    "variants" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "basedOnComponents" TEXT,
    "creationReason" TEXT,
    "differences" TEXT,
    "imagePrompt" TEXT,
    "designSpec" TEXT,
    "usageGuidelines" TEXT,
    "accessibilityNotes" TEXT,
    "usedInScreens" TEXT,
    "sourceScreenId" TEXT,
    "sourceScreenVersionId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "screensUsedIn" TEXT,
    "projectsUsedIn" TEXT,
    "similarityHistory" TEXT,
    "editHistory" TEXT,
    "approveHistory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "preview" TEXT,
    "metadata" TEXT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignPattern" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "layoutJson" TEXT,
    "componentIds" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignImport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourcePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "analysisJson" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentSimilarityReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "componentId" TEXT,
    "candidateName" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "recommendation" TEXT NOT NULL,
    "reasonsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentSimilarityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleSimilarityReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "screenVersionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasonsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleSimilarityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignDecision" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenSummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "screenVersionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mainPurpose" TEXT NOT NULL,
    "primaryUserAction" TEXT,
    "usedPatterns" TEXT,
    "usedRules" TEXT,
    "visualNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptLog" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRule_projectId_idx" ON "ProjectRule"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Screen_approvedVersionId_key" ON "Screen"("approvedVersionId");

-- CreateIndex
CREATE INDEX "Screen_projectId_idx" ON "Screen"("projectId");

-- CreateIndex
CREATE INDEX "ScreenVersion_screenId_idx" ON "ScreenVersion"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenVersion_screenId_versionNumber_key" ON "ScreenVersion"("screenId", "versionNumber");

-- CreateIndex
CREATE INDEX "DesignComponent_projectId_status_idx" ON "DesignComponent"("projectId", "status");

-- CreateIndex
CREATE INDEX "DesignComponent_projectId_category_idx" ON "DesignComponent"("projectId", "category");

-- CreateIndex
CREATE INDEX "DesignComponent_sourceScreenVersionId_idx" ON "DesignComponent"("sourceScreenVersionId");

-- CreateIndex
CREATE INDEX "DesignToken_projectId_group_idx" ON "DesignToken"("projectId", "group");

-- CreateIndex
CREATE UNIQUE INDEX "DesignToken_projectId_group_name_key" ON "DesignToken"("projectId", "group", "name");

-- CreateIndex
CREATE INDEX "DesignAsset_projectId_type_idx" ON "DesignAsset"("projectId", "type");

-- CreateIndex
CREATE INDEX "DesignPattern_projectId_category_idx" ON "DesignPattern"("projectId", "category");

-- CreateIndex
CREATE INDEX "DesignImport_projectId_status_idx" ON "DesignImport"("projectId", "status");

-- CreateIndex
CREATE INDEX "ComponentSimilarityReport_projectId_score_idx" ON "ComponentSimilarityReport"("projectId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "StyleSimilarityReport_screenVersionId_key" ON "StyleSimilarityReport"("screenVersionId");

-- CreateIndex
CREATE INDEX "StyleSimilarityReport_projectId_score_idx" ON "StyleSimilarityReport"("projectId", "score");

-- CreateIndex
CREATE INDEX "DesignDecision_projectId_status_idx" ON "DesignDecision"("projectId", "status");

-- CreateIndex
CREATE INDEX "DesignDecision_screenId_idx" ON "DesignDecision"("screenId");

-- CreateIndex
CREATE INDEX "DesignDecision_screenVersionId_idx" ON "DesignDecision"("screenVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenSummary_screenVersionId_key" ON "ScreenSummary"("screenVersionId");

-- CreateIndex
CREATE INDEX "ScreenSummary_projectId_idx" ON "ScreenSummary"("projectId");

-- CreateIndex
CREATE INDEX "ScreenSummary_screenId_idx" ON "ScreenSummary"("screenId");

-- CreateIndex
CREATE INDEX "AiPromptLog_projectId_createdAt_idx" ON "AiPromptLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiPromptLog_screenId_idx" ON "AiPromptLog"("screenId");

-- CreateIndex
CREATE INDEX "AiPromptLog_screenVersionId_idx" ON "AiPromptLog"("screenVersionId");

-- AddForeignKey
ALTER TABLE "ProjectRule" ADD CONSTRAINT "ProjectRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "ScreenVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenVersion" ADD CONSTRAINT "ScreenVersion_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignComponent" ADD CONSTRAINT "DesignComponent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignToken" ADD CONSTRAINT "DesignToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignAsset" ADD CONSTRAINT "DesignAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPattern" ADD CONSTRAINT "DesignPattern_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignImport" ADD CONSTRAINT "DesignImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentSimilarityReport" ADD CONSTRAINT "ComponentSimilarityReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentSimilarityReport" ADD CONSTRAINT "ComponentSimilarityReport_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "DesignComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleSimilarityReport" ADD CONSTRAINT "StyleSimilarityReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleSimilarityReport" ADD CONSTRAINT "StyleSimilarityReport_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDecision" ADD CONSTRAINT "DesignDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDecision" ADD CONSTRAINT "DesignDecision_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDecision" ADD CONSTRAINT "DesignDecision_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenSummary" ADD CONSTRAINT "ScreenSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenSummary" ADD CONSTRAINT "ScreenSummary_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenSummary" ADD CONSTRAINT "ScreenSummary_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptLog" ADD CONSTRAINT "AiPromptLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptLog" ADD CONSTRAINT "AiPromptLog_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptLog" ADD CONSTRAINT "AiPromptLog_screenVersionId_fkey" FOREIGN KEY ("screenVersionId") REFERENCES "ScreenVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
