import type { LayoutElement, LayoutJson } from "@/lib/layout";

type ProjectRule = { category: string; name: string; value: string };

const tagByType: Record<LayoutElement["type"], string> = {
  text: "Text",
  card: "Card",
  button: "Button",
  icon: "Icon",
  avatar: "Avatar",
  image: "Image",
  illustration: "Illustration",
  bottomNav: "BottomNavigation",
  section: "Section",
  input: "Input",
  chip: "Chip",
  badge: "Badge",
  progress: "Progress",
};

export function generateHtmlLayout(layoutJson: LayoutJson, designSpec = "", projectRules: ProjectRule[] = []) {
  const background = findBackground(projectRules, designSpec);
  const lines = [`<Screen width="${layoutJson.viewport.width}" height="${layoutJson.viewport.height}">`];
  if (background) lines.push(`  <Background color="${escapeAttribute(background)}" />`, "");
  layoutJson.elements.forEach((element, index) => {
    lines.push(...renderElement(element));
    if (index < layoutJson.elements.length - 1) lines.push("");
  });
  lines.push("</Screen>");
  return lines.join("\n");
}

function renderElement(element: LayoutElement) {
  const tag = element.type === "button" && /primary|основн/i.test(element.style || "") ? "PrimaryButton" : tagByType[element.type];
  const attributes: Array<[string, string | number | boolean | undefined]> = [
    ["id", element.id], ["x", element.x], ["y", element.y], ["width", element.width], ["height", element.height],
    ["align", element.align], ["style", element.style], ["radius", element.radius], ["background", element.background],
    ["opacity", element.opacity], ["zIndex", element.zIndex], ["locked", element.locked ? true : undefined],
  ];
  const attributeLines = attributes
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([name, value]) => `    ${name}="${escapeAttribute(String(value))}"`);
  const label = escapeText(element.label || element.id);
  if (element.type === "text" || element.type === "button" || element.type === "chip" || element.type === "badge") {
    return [`  <${tag}`, ...attributeLines, "  >", `    ${label}`, `  </${tag}>`];
  }
  return [`  <${tag}`, ...attributeLines, `    label="${escapeAttribute(label)}"`, "  />"];
}

function findBackground(rules: ProjectRule[], designSpec: string) {
  const rule = rules.find((item) => /background|фон/i.test(`${item.category} ${item.name}`) && /#(?:[0-9a-f]{3}){1,2}\b/i.test(item.value));
  if (rule) return rule.value.match(/#(?:[0-9a-f]{3}){1,2}\b/i)?.[0];
  return designSpec.match(/(?:background|фон)[^#]{0,30}(#(?:[0-9a-f]{3}){1,2}\b)/i)?.[1];
}

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
