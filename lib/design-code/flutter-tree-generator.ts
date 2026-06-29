import type { LayoutElement, LayoutJson } from "@/lib/layout";

type ProjectRule = { category: string; name: string; value: string };

export function generateFlutterWidgetTree(layoutJson: LayoutJson, designSpec = "", projectRules: ProjectRule[] = []) {
  const context = projectRules.length || designSpec
    ? `// DesignPilot readable widget tree · ${projectRules.length} project rules applied\n`
    : "";
  const children = layoutJson.elements.map((element) => indent(renderPositioned(element), 8)).join(",\n");
  return `${context}Scaffold(
  body: SizedBox(
    width: ${layoutJson.viewport.width},
    height: ${layoutJson.viewport.height},
    child: Stack(
      children: [
${children}
      ],
    ),
  ),
)`;
}

function renderPositioned(element: LayoutElement) {
  const widget = renderWidget(element).replaceAll("\n", "\n  ");
  return `Positioned(
  left: ${element.x},
  top: ${element.y},
  width: ${element.width},
  height: ${element.height},
  child: ${widget},
)`;
}

function renderWidget(element: LayoutElement) {
  const label = escapeDart(element.label || element.id);
  switch (element.type) {
    case "text":
      return `Text(
  '${label}',
  textAlign: TextAlign.${flutterAlignment(element.align)},
)`;
    case "button":
      return `ElevatedButton(
  onPressed: () {},
  child: Text('${label}'),
)`;
    case "card":
      return `Card(
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(${element.radius ?? 0})),
  child: Center(child: Text('${label}')),
)`;
    case "icon":
      return `Tooltip(message: '${label}', child: const Icon(Icons.circle_outlined))`;
    case "avatar":
      return `CircleAvatar(child: Text('${escapeDart(label.slice(0, 1))}'))`;
    case "input":
      return `TextField(decoration: InputDecoration(labelText: '${label}'))`;
    case "chip":
      return `Chip(label: Text('${label}'))`;
    case "progress":
      return `Semantics(label: '${label}', child: const CircularProgressIndicator())`;
    case "bottomNav":
      return `Container(
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(${element.radius ?? 0})),
  child: const Placeholder(), // BottomNavigationBar: ${label}
)`;
    case "image":
    case "illustration":
      return `Container(
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(${element.radius ?? 0})),
  child: Center(child: Text('${label}')), // ${element.type} placeholder
)`;
    case "badge":
      return `Container(
  alignment: Alignment.center,
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(${element.radius ?? 999})),
  child: Text('${label}'),
)`;
    case "section":
    default:
      return `Container(
  decoration: BoxDecoration(borderRadius: BorderRadius.circular(${element.radius ?? 0})),
  child: Center(child: Text('${label}')),
)`;
  }
}

function flutterAlignment(align?: string) {
  if (align === "right" || align === "end") return "right";
  if (align === "center") return "center";
  return "left";
}

function indent(value: string, spaces: number) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function escapeDart(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
