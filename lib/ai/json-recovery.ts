import "server-only";

export type JsonRecoveryStage =
  | "raw"
  | "markdown_fence"
  | "object_range"
  | "comments_removed"
  | "trailing_commas_removed"
  | "single_quotes_converted"
  | "control_chars_removed";

export type JsonRecoveryResult =
  | {
      ok: true;
      value: unknown;
      jsonText: string;
      repairedText: string;
      stages: JsonRecoveryStage[];
      warnings: string[];
    }
  | {
      ok: false;
      jsonText: string;
      repairedText: string;
      stages: JsonRecoveryStage[];
      warnings: string[];
      error: string;
    };

export class AiJsonRecoveryError extends Error {
  readonly code = "AI_JSON_RECOVERY_FAILED";
  constructor(
    message: string,
    readonly details: {
      rawResponse: string;
      jsonText: string;
      repairedText: string;
      stages: JsonRecoveryStage[];
      warnings: string[];
      validationErrors?: string[];
    },
  ) {
    super(message);
    this.name = "AiJsonRecoveryError";
  }
}

export function recoverJson(rawResponse: string): JsonRecoveryResult {
  const stages: JsonRecoveryStage[] = ["raw"];
  const warnings: string[] = [];
  const jsonText = extractJsonText(rawResponse, stages, warnings);
  const attempts = buildRepairAttempts(jsonText, stages, warnings);

  for (const attempt of attempts) {
    try {
      return {
        ok: true,
        value: JSON.parse(attempt.text) as unknown,
        jsonText,
        repairedText: attempt.text,
        stages: uniqueStages([...stages, ...attempt.stages]),
        warnings,
      };
    } catch {
      // Try next repair level.
    }
  }

  const last = attempts.at(-1)?.text ?? jsonText;
  try {
    JSON.parse(last);
  } catch (error) {
    return {
      ok: false,
      jsonText,
      repairedText: last,
      stages: uniqueStages([...stages, ...(attempts.at(-1)?.stages ?? [])]),
      warnings,
      error: error instanceof Error ? error.message : "JSON parse failed",
    };
  }

  return {
    ok: false,
    jsonText,
    repairedText: last,
    stages,
    warnings,
    error: "Не удалось разобрать JSON.",
  };
}

export function throwJsonRecoveryError(rawResponse: string, result: JsonRecoveryResult, validationErrors?: string[]): never {
  throw new AiJsonRecoveryError(validationErrors?.length ? "JSON восстановлен, но не прошёл проверку." : result.ok ? "JSON не прошёл проверку." : result.error, {
    rawResponse,
    jsonText: result.jsonText,
    repairedText: result.repairedText,
    stages: result.stages,
    warnings: result.warnings,
    validationErrors,
  });
}

function extractJsonText(raw: string, stages: JsonRecoveryStage[], warnings: string[]) {
  let text = raw.trim();
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    text = fence[1].trim();
    stages.push("markdown_fence");
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    if (first > 0 || last < text.length - 1) warnings.push("JSON найден внутри обычного текста, использован диапазон от первой { до последней }.");
    text = text.slice(first, last + 1).trim();
    stages.push("object_range");
  }

  return text;
}

function buildRepairAttempts(jsonText: string, stages: JsonRecoveryStage[], warnings: string[]) {
  const attempts: Array<{ text: string; stages: JsonRecoveryStage[] }> = [{ text: jsonText, stages: [] }];
  let text = jsonText;

  const withoutComments = stripJsonComments(text);
  if (withoutComments !== text) {
    text = withoutComments;
    attempts.push({ text, stages: ["comments_removed"] });
  }

  const withoutTrailingCommas = stripTrailingCommas(text);
  if (withoutTrailingCommas !== text) {
    text = withoutTrailingCommas;
    attempts.push({ text, stages: ["trailing_commas_removed"] });
  }

  const withoutControls = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  if (withoutControls !== text) {
    text = withoutControls;
    attempts.push({ text, stages: ["control_chars_removed"] });
  }

  const singleQuoteRepair = convertLikelySingleQuotedJson(text);
  if (singleQuoteRepair !== text) {
    warnings.push("Применена эвристика замены одинарных кавычек на двойные.");
    attempts.push({ text: singleQuoteRepair, stages: ["single_quotes_converted"] });
    const combined = stripTrailingCommas(stripJsonComments(singleQuoteRepair));
    if (combined !== singleQuoteRepair) attempts.push({ text: combined, stages: ["single_quotes_converted", "comments_removed", "trailing_commas_removed"] });
  }

  // Also try a full repair pass in one go.
  const fullRepair = stripTrailingCommas(stripJsonComments(convertLikelySingleQuotedJson(jsonText))).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  if (!attempts.some((attempt) => attempt.text === fullRepair)) {
    attempts.push({ text: fullRepair, stages: ["comments_removed", "trailing_commas_removed", "single_quotes_converted", "control_chars_removed"] });
  }

  return attempts.map((attempt) => ({ ...attempt, stages: uniqueStages([...stages, ...attempt.stages]) }));
}

function stripJsonComments(input: string) {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripTrailingCommas(input: string) {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }
    if (char === ",") {
      let cursor = index + 1;
      while (/\s/.test(input[cursor] ?? "")) cursor += 1;
      if (input[cursor] === "}" || input[cursor] === "]") continue;
    }
    output += char;
  }
  return output;
}

function convertLikelySingleQuotedJson(input: string) {
  // Conservative repair for common LLM output: {'key': 'value'}.
  return input
    .replace(/([{,\[]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, (_match, prefix: string, key: string) => `${prefix}"${escapeDoubleQuotes(key)}":`)
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'(\s*[,}\]])/g, (_match, value: string, suffix: string) => `: "${escapeDoubleQuotes(value)}"${suffix}`)
    .replace(/(\[\s*|,\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*[,}\]])/g, (_match, prefix: string, value: string, suffix: string) => `${prefix}"${escapeDoubleQuotes(value)}"${suffix}`);
}

function escapeDoubleQuotes(value: string) {
  return value.replace(/"/g, "\\\"");
}

function uniqueStages(stages: JsonRecoveryStage[]) {
  return Array.from(new Set(stages));
}
