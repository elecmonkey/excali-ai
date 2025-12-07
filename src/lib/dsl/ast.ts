/**
 * DSL AST definitions for Excalidraw semantic layer.
 * The AST is intentionally minimal so it can be serialized back to text
 * and mapped to Excalidraw JSON.
 */

export type Vec2 = [number, number];

export type NodeKind =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "text"
  | "image"
  | "iframe"
  | "embeddable"
  | "frame"
  | "magicframe"
  | "freedraw";

export type EdgeKind = "line" | "arrow" | "elbow-arrow" | "curved-arrow" | "sharp-arrow";

export interface BaseBlock {
  id: string;
  ref?: string;
  meta?: Record<string, unknown>;
}

export interface NodeBlock extends BaseBlock {
  kind: "node";
  nodeKind: NodeKind;
  label?: string;
  at?: Vec2;
  size?: Vec2;
  points?: Vec2[];
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  container?: string;
  file?: string;
  frame?: string;
  groups?: string[];
  link?: string;
  locked?: boolean;
  inEdges?: { edgeId: string; from?: string | null }[];
  outEdges?: { edgeId: string; to?: string | null }[];
}

export interface EdgeBlock extends BaseBlock {
  kind: "edge";
  edgeKind: EdgeKind;
  from?: string | null;
  to?: string | null;
  via?: Vec2[];
  start?: Vec2;
  end?: Vec2;
  startArrow?: string | null;
  endArrow?: string | null;
  mode?: "inside" | "orbit";
  frame?: string;
  groups?: string[];
  link?: string;
  locked?: boolean;
  label?: string;
}

export interface FileBlock {
  kind: "file";
  id: string;
  mime?: string;
  data?: string;
  version?: number;
}

export interface AppStateBlock {
  kind: "appState";
  viewBackgroundColor?: string;
  gridSize?: number;
  gridStep?: number;
  gridModeEnabled?: boolean;
  lockedMultiSelections?: Record<string, boolean>;
  meta?: Record<string, unknown>;
}

export interface UpdateBlock {
  kind: "update";
  target: "node" | "edge";
  id: string;
  values: Record<string, unknown>;
}

export interface DeleteBlock {
  kind: "delete";
  target: "node" | "edge";
  id: string;
}

export interface LayoutBlock {
  kind: "layout";
  mode: string;
  nodes?: string[];
}

export type Statement =
  | NodeBlock
  | EdgeBlock
  | FileBlock
  | AppStateBlock
  | UpdateBlock
  | DeleteBlock
  | LayoutBlock;

export interface DSLDocument {
  statements: Statement[];
}
