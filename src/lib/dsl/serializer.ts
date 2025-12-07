import { DSLDocument, EdgeBlock, FileBlock, NodeBlock, Statement, UpdateBlock, DeleteBlock, AppStateBlock, LayoutBlock } from "./ast";

function fmtVec2(v?: [number, number]) {
  return v ? `(${v[0]}, ${v[1]})` : "";
}

function fmtVec2Array(arr?: [number, number][]) {
  if (!arr) return "";
  return `[${arr.map((p) => fmtVec2(p)).join(", ")}]`;
}

function indentLines(lines: string[]) {
  return lines.map((l) => `  ${l}`).join("\n");
}

function serializeNode(node: NodeBlock): string {
  const lines: string[] = [`kind: ${node.nodeKind}`];
  if (node.label) lines.push(`label: "${node.label}"`);
  if (node.at) lines.push(`at: ${fmtVec2(node.at)}`);
  if (node.size) lines.push(`size: ${fmtVec2(node.size)}`);
  if (node.points) lines.push(`points: ${fmtVec2Array(node.points)}`);
  if (node.textAlign) lines.push(`textAlign: ${node.textAlign}`);
  if (node.verticalAlign) lines.push(`verticalAlign: ${node.verticalAlign}`);
  if (node.container) lines.push(`container: ${node.container}`);
  if (node.file) lines.push(`file: ${node.file}`);
  if (node.frame) lines.push(`frame: ${node.frame}`);
  if (node.groups) lines.push(`groups: [${node.groups.join(", ")}]`);
  if (node.link) lines.push(`link: "${node.link}"`);
  if (node.locked !== undefined) lines.push(`locked: ${node.locked}`);
  if (node.ref) lines.push(`ref: ${node.ref}`);
  return `node ${node.id} {\n${indentLines(lines)}\n}`;
}

function serializeEdge(edge: EdgeBlock): string {
  const lines: string[] = [`kind: ${edge.edgeKind}`];
  if (edge.from) lines.push(`from: ${edge.from}`);
  if (edge.to) lines.push(`to: ${edge.to}`);
  if (edge.via) lines.push(`via: ${fmtVec2Array(edge.via)}`);
  if (edge.start) lines.push(`start: ${fmtVec2(edge.start)}`);
  if (edge.end) lines.push(`end: ${fmtVec2(edge.end)}`);
  if (edge.startArrow !== undefined) lines.push(`startArrow: ${edge.startArrow}`);
  if (edge.endArrow !== undefined) lines.push(`endArrow: ${edge.endArrow}`);
  if (edge.mode) lines.push(`mode: ${edge.mode}`);
  if (edge.frame) lines.push(`frame: ${edge.frame}`);
  if (edge.groups) lines.push(`groups: [${edge.groups.join(", ")}]`);
  if (edge.link) lines.push(`link: "${edge.link}"`);
  if (edge.locked !== undefined) lines.push(`locked: ${edge.locked}`);
  if (edge.label) lines.push(`label: "${edge.label}"`);
  if (edge.ref) lines.push(`ref: ${edge.ref}`);
  return `edge ${edge.id} {\n${indentLines(lines)}\n}`;
}

function serializeFile(file: FileBlock): string {
  const lines: string[] = [];
  if (file.mime) lines.push(`mime: "${file.mime}"`);
  if (file.data) lines.push(`data: "${file.data}"`);
  if (file.version !== undefined) lines.push(`version: ${file.version}`);
  return `file ${file.id} {\n${indentLines(lines)}\n}`;
}

function serializeAppState(app: AppStateBlock): string {
  const lines: string[] = [];
  if (app.viewBackgroundColor) lines.push(`viewBackgroundColor: "${app.viewBackgroundColor}"`);
  if (app.gridSize !== undefined) lines.push(`gridSize: ${app.gridSize}`);
  if (app.gridStep !== undefined) lines.push(`gridStep: ${app.gridStep}`);
  if (app.gridModeEnabled !== undefined) lines.push(`gridModeEnabled: ${app.gridModeEnabled}`);
  if (app.lockedMultiSelections) {
    lines.push(`lockedMultiSelections: ${JSON.stringify(app.lockedMultiSelections)}`);
  }
  return `appState {\n${indentLines(lines)}\n}`;
}

function serializeUpdate(update: UpdateBlock): string {
  const lines = Object.entries(update.values).map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`);
  return `update ${update.target} ${update.id} {\n${indentLines(lines)}\n}`;
}

function serializeDelete(del: DeleteBlock): string {
  return `delete ${del.target} ${del.id}`;
}

function serializeLayout(layout: LayoutBlock): string {
  if (layout.nodes?.length) {
    return `layout ${layout.mode} {\n${indentLines([`nodes: [${layout.nodes.join(", ")}]`])}\n}`;
  }
  return `layout ${layout.mode}`;
}

function serializeStatement(stmt: Statement): string {
  switch (stmt.kind) {
    case "node":
      return serializeNode(stmt);
    case "edge":
      return serializeEdge(stmt);
    case "file":
      return serializeFile(stmt);
    case "appState":
      return serializeAppState(stmt);
    case "update":
      return serializeUpdate(stmt);
    case "delete":
      return serializeDelete(stmt);
    case "layout":
      return serializeLayout(stmt);
    default:
      return "";
  }
}

export function serializeDSL(doc: DSLDocument): string {
  return doc.statements.map(serializeStatement).filter(Boolean).join("\n\n");
}
