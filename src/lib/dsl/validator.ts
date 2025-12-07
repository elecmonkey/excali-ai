import { DSLDocument, Statement } from "./ast";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  ref?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validateDSL(doc: DSLDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  const checkId = (stmt: Statement, id?: string) => {
    if (!id) {
      issues.push({ level: "error", message: "Missing id", ref: stmt.kind });
      return;
    }
    if (ids.has(id)) {
      issues.push({ level: "error", message: `Duplicate id: ${id}`, ref: id });
    } else {
      ids.add(id);
    }
  };

  for (const stmt of doc.statements) {
    switch (stmt.kind) {
      case "node":
      case "edge":
        checkId(stmt, stmt.id);
        break;
      case "file":
      case "delete":
      case "update":
        checkId(stmt, stmt.id);
        break;
      default:
        break;
    }
  }

  return { ok: issues.length === 0, issues };
}
