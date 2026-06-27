import "server-only";
import { prisma } from "@/lib/prisma";

const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 45_000;

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: boolean;
        schema: Record<string, unknown>;
      };
    };

export type AiLogAction =
  | "generate_screen"
  | "edit_screen"
  | "summarize_screen"
  | "extract_decisions"
  | "test_openrouter";

type AiLogContext = {
  projectId: string;
  screenId?: string;
  screenVersionId?: string;
  action: AiLogAction;
  requestPreview: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
};

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: {
    model?: string;
    responseFormat?: OpenRouterResponseFormat;
    temperature?: number;
    maxTokens?: number;
  } = {},
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = options.model?.trim() || process.env.OPENROUTER_MODEL?.trim();
  const apiUrl = process.env.OPENROUTER_API_URL?.trim() || DEFAULT_OPENROUTER_URL;

  if (!apiKey) throw new OpenRouterError("OPENROUTER_API_KEY не настроен на сервере.");
  if (!model) throw new OpenRouterError("OPENROUTER_MODEL не настроен на сервере.");
  if (!messages.length) throw new OpenRouterError("Для запроса требуется хотя бы одно сообщение.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-OpenRouter-Title": "EDUS AI Design Prompt Builder",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
        ...(typeof options.maxTokens === "number" ? { max_tokens: options.maxTokens } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as OpenRouterResponse | null;

    if (!response.ok) {
      const detail = data?.error?.message?.trim();
      throw new OpenRouterError(
        detail ? `OpenRouter: ${detail}` : `OpenRouter вернул ошибку ${response.status}.`,
        response.status,
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string"
      ? content.trim()
      : content?.map((part) => part.text ?? "").join("").trim();

    if (!text) throw new OpenRouterError("OpenRouter вернул пустой ответ.");
    return text;
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError("OpenRouter не ответил за 45 секунд.");
    }
    throw new OpenRouterError("Не удалось подключиться к OpenRouter.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function callOpenRouterTracked(
  messages: OpenRouterMessage[],
  options: {
    model?: string;
    responseFormat?: OpenRouterResponseFormat;
    temperature?: number;
    maxTokens?: number;
    log: AiLogContext;
  },
) {
  const model = options.model?.trim() || process.env.OPENROUTER_MODEL?.trim() || "not-configured";
  const fullPrompt = JSON.stringify(messages, null, 2);
  const log = await prisma.aiPromptLog.create({
    data: {
      projectId: options.log.projectId,
      screenId: options.log.screenId,
      screenVersionId: options.log.screenVersionId,
      action: options.log.action,
      model,
      requestPreview: options.log.requestPreview.slice(0, 500),
      fullPrompt,
    },
    select: { id: true },
  });

  try {
    const text = await callOpenRouter(messages, options);
    await prisma.aiPromptLog.update({
      where: { id: log.id },
      data: { rawResponse: text },
    });
    return { text, logId: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка OpenRouter.";
    await prisma.aiPromptLog.update({
      where: { id: log.id },
      data: { error: message },
    });
    throw error;
  }
}

export async function completeAiPromptLog(
  logId: string,
  data: { parsedResponse?: unknown; screenVersionId?: string; error?: string },
) {
  await prisma.aiPromptLog.update({
    where: { id: logId },
    data: {
      ...(data.parsedResponse !== undefined ? { parsedResponse: JSON.stringify(data.parsedResponse) } : {}),
      ...(data.screenVersionId ? { screenVersionId: data.screenVersionId } : {}),
      ...(data.error ? { error: data.error } : {}),
    },
  });
}
