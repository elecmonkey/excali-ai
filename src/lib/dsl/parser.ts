import { AppStateBlock, DSLDocument, EdgeBlock, EdgeKind, FileBlock, LayoutBlock, NodeBlock, NodeKind, Statement, UpdateBlock, DeleteBlock } from "./ast";

function parseTuple(value: string) {
  const match = value.match(/^\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])] as [number, number];
}

function parseArrayOfTuples(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(/\s*,\s*/)
    .map((item) => parseTuple(item))
    .filter((v): v is [number, number] => Array.isArray(v));
}

function parsePrimitive(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") {
    return num;
  }

  // Simple string list ["a", "b"]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(/\s*,\s*/).map((s) => s.replace(/^"|"$/g, ""));
  }

  return trimmed;
}

function parseValue(raw: string): unknown {
  return (
    parseTuple(raw) ??
    parseArrayOfTuples(raw) ??
    parsePrimitive(raw)
  );
}

function parseKeyValues(body: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) continue;
    const valueStr = rest.join(":").trim();
    values[key.trim()] = parseValue(valueStr);
  }
  return values;
}

function parseNode(id: string, body: string): NodeBlock {
  const kv = parseKeyValues(body);
  return {
    kind: "node",
    id,
    nodeKind: (kv.kind as NodeKind) || "rectangle",
    label: kv.label as string | undefined,
    at: kv.at as [number, number] | undefined,
    size: kv.size as [number, number] | undefined,
    points: kv.points as [number, number][] | undefined,
    textAlign: kv.textAlign as NodeBlock["textAlign"],
    verticalAlign: kv.verticalAlign as NodeBlock["verticalAlign"],
    container: kv.container as string | undefined,
    file: kv.file as string | undefined,
    frame: kv.frame as string | undefined,
    groups: kv.groups as string[] | undefined,
    link: kv.link as string | undefined,
    locked: kv.locked as boolean | undefined,
    meta: kv.meta as Record<string, unknown> | undefined,
    ref: kv.ref as string | undefined,
  };
}

function parseEdge(id: string, body: string): EdgeBlock {
  const kv = parseKeyValues(body);
  return {
    kind: "edge",
    id,
    edgeKind: (kv.kind as EdgeKind) || "arrow",
    from: kv.from as string | undefined,
    to: kv.to as string | undefined,
    via: kv.via as [number, number][] | undefined,
    start: kv.start as [number, number] | undefined,
    end: kv.end as [number, number] | undefined,
    startArrow: (kv.startArrow as string | null | undefined) ?? undefined,
    endArrow: (kv.endArrow as string | null | undefined) ?? undefined,
    mode: kv.mode as EdgeBlock["mode"],
    frame: kv.frame as string | undefined,
    groups: kv.groups as string[] | undefined,
    link: kv.link as string | undefined,
    locked: kv.locked as boolean | undefined,
    label: kv.label as string | undefined,
    meta: kv.meta as Record<string, unknown> | undefined,
    ref: kv.ref as string | undefined,
  };
}

function parseFile(id: string, body: string): FileBlock {
  const kv = parseKeyValues(body);
  return {
    kind: "file",
    id,
    mime: kv.mime as string | undefined,
    data: kv.data as string | undefined,
    version: kv.version as number | undefined,
  };
}

function parseAppState(body: string): AppStateBlock {
  const kv = parseKeyValues(body);
  return {
    kind: "appState",
    viewBackgroundColor: kv.viewBackgroundColor as string | undefined,
    gridSize: kv.gridSize as number | undefined,
    gridStep: kv.gridStep as number | undefined,
    gridModeEnabled: kv.gridModeEnabled as boolean | undefined,
    lockedMultiSelections: kv.lockedMultiSelections as Record<string, boolean> | undefined,
    meta: kv.meta as Record<string, unknown> | undefined,
  };
}

function parseUpdate(target: "node" | "edge", id: string, body: string): UpdateBlock {
  const values = parseKeyValues(body);
  return { kind: "update", target, id, values };
}

function parseDelete(target: "node" | "edge", id: string): DeleteBlock {
  return { kind: "delete", target, id };
}

function parseLayout(mode: string, body?: string): LayoutBlock {
  const nodes = body ? (parseKeyValues(body).nodes as string[] | undefined) : undefined;
  return { kind: "layout", mode, nodes };
}

function collectBlocks(text: string): Array<{ header: string; id: string; body: string | null }> {
  const blocks: Array<{ header: string; id: string; body: string | null }> = [];
  const regex = /(node|edge|file|appState|update node|update edge|delete node|delete edge|layout)\s+([^\s{]+)?\s*\{/g;
  let lastIndex = 0;

  while (true) {
    const match = regex.exec(text);
    if (!match) break;

    const startIndex = match.index;
    const braceIndex = text.indexOf("{", regex.lastIndex - 1);
    if (braceIndex === -1) break;

    let depth = 0;
    let endIndex = -1;
    for (let i = braceIndex; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) break;

    const header = match[1];
    const id = (match[2] || "").trim();
    const body = text.slice(braceIndex + 1, endIndex).trim();
    blocks.push({ header, id, body });
    lastIndex = endIndex + 1;
  }

  // Handle layout without braces: "layout auto"
  const layoutRegex = /layout\s+([^\s{]+)\s*(?:\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = layoutRegex.exec(text))) {
    blocks.push({ header: "layout", id: m[1], body: null });
  }

  return blocks;
}

export function parseDSL(text: string): DSLDocument {
  const clean = text.trim();
  if (!clean) return { statements: [] };

  const blocks = collectBlocks(clean);
  const statements: Statement[] = [];

  for (const block of blocks) {
    switch (block.header) {
      case "node":
        statements.push(parseNode(block.id, block.body || ""));
        break;
      case "edge":
        statements.push(parseEdge(block.id, block.body || ""));
        break;
      case "file":
        statements.push(parseFile(block.id, block.body || ""));
        break;
      case "appState":
        statements.push(parseAppState(block.body || ""));
        break;
      case "update node":
        statements.push(parseUpdate("node", block.id, block.body || ""));
        break;
      case "update edge":
        statements.push(parseUpdate("edge", block.id, block.body || ""));
        break;
      case "delete node":
        statements.push(parseDelete("node", block.id));
        break;
      case "delete edge":
        statements.push(parseDelete("edge", block.id));
        break;
      case "layout":
        statements.push(parseLayout(block.id, block.body || undefined));
        break;
      default:
        break;
    }
  }

  return { statements };
}
