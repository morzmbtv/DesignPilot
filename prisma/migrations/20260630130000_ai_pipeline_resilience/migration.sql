-- Store OpenRouter response metadata before any parsing/validation.
ALTER TABLE "AiPromptLog" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'openrouter';
ALTER TABLE "AiPromptLog" ADD COLUMN IF NOT EXISTS "finishReason" TEXT;
ALTER TABLE "AiPromptLog" ADD COLUMN IF NOT EXISTS "tokensJson" TEXT;
