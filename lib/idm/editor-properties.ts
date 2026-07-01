import type { IdmElement } from "@/lib/idm/types";

export type EditorProperties = {
  rotation: number;
  fontFamily: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign: "left" | "center" | "right";
};

const PREFIX = "editor:";

export function readEditorProperties(element: IdmElement): EditorProperties {
  const values = new Map<string, string>();
  for (const constraint of element.constraints) {
    if (!constraint.startsWith(PREFIX)) continue;
    const separator = constraint.indexOf("=");
    if (separator > PREFIX.length) values.set(constraint.slice(PREFIX.length, separator), constraint.slice(separator + 1));
  }
  return {
    rotation: finite(values.get("rotation"), 0),
    fontFamily: values.get("fontFamily") || "",
    fontSize: optionalNumber(values.get("fontSize")),
    fontWeight: optionalNumber(values.get("fontWeight")),
    textAlign: alignment(values.get("textAlign") || element.layout.align),
  };
}

export function writeEditorProperties(element: IdmElement, patch: Partial<EditorProperties>): IdmElement {
  const current = { ...readEditorProperties(element), ...patch };
  const constraints = element.constraints.filter((constraint) => !constraint.startsWith(PREFIX));
  constraints.push(
    `${PREFIX}rotation=${current.rotation}`,
    `${PREFIX}textAlign=${current.textAlign}`,
  );
  if (current.fontFamily) constraints.push(`${PREFIX}fontFamily=${current.fontFamily}`);
  if (current.fontSize !== undefined) constraints.push(`${PREFIX}fontSize=${current.fontSize}`);
  if (current.fontWeight !== undefined) constraints.push(`${PREFIX}fontWeight=${current.fontWeight}`);
  return { ...element, constraints, layout: { ...element.layout, align: current.textAlign } };
}

function finite(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function optionalNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function alignment(value: string | undefined): EditorProperties["textAlign"] {
  return value === "center" || value === "right" ? value : "left";
}
