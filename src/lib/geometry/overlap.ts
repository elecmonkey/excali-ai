import type { ExcalidrawElement } from "@/lib/client-tools/types";

type Point = [number, number];

interface NodeGeom {
  id: string;
  type: string;
  points: Point[];
  area: number;
}

interface OverlapResult {
  a: string;
  b: string;
  overlapArea: number;
  overlapRatio: number;
}

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function clipAgainstEdge(subject: Point[], a: Point, b: Point, orientation: number): Point[] {
  const output: Point[] = [];

  const isInside = (p: Point) => {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    return orientation >= 0 ? cross >= 0 : cross <= 0;
  };

  const intersection = (p1: Point, p2: Point): Point => {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = a;
    const [x4, y4] = b;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return p2;
    const px =
      ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
    const py =
      ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
    return [px, py];
  };

  for (let i = 0; i < subject.length; i++) {
    const current = subject[i];
    const prev = subject[(i - 1 + subject.length) % subject.length];
    const currInside = isInside(current);
    const prevInside = isInside(prev);

    if (currInside) {
      if (!prevInside) {
        output.push(intersection(prev, current));
      }
      output.push(current);
    } else if (prevInside) {
      output.push(intersection(prev, current));
    }
  }

  return output;
}

function polygonIntersectionArea(a: Point[], b: Point[]): number {
  const orientB = Math.sign(signedArea(b)) || 1;
  let output = [...a];
  for (let i = 0; i < b.length; i++) {
    const aPoint = b[i];
    const bPoint = b[(i + 1) % b.length];
    output = clipAgainstEdge(output, aPoint, bPoint, orientB);
    if (output.length === 0) break;
  }
  return output.length ? polygonArea(output) : 0;
}

function ellipsePolygon(el: ExcalidrawElement, segments = 16): Point[] {
  const cx = (el.x as number) + (el.width as number) / 2;
  const cy = (el.y as number) + (el.height as number) / 2;
  const rx = (el.width as number) / 2;
  const ry = (el.height as number) / 2;
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Use -sin to keep polygon orientation consistent (CCW in screen coords)
    pts.push([cx + rx * Math.cos(t), cy - ry * Math.sin(t)]);
  }
  return pts;
}

function diamondPolygon(el: ExcalidrawElement): Point[] {
  const cx = (el.x as number) + (el.width as number) / 2;
  const cy = (el.y as number) + (el.height as number) / 2;
  return [
    [cx, el.y as number],
    [el.x as number, cy],
    [cx, (el.y as number) + (el.height as number)],
    [(el.x as number) + (el.width as number), cy],
  ];
}

function rectPolygon(el: ExcalidrawElement): Point[] {
  return [
    [el.x as number, el.y as number],
    [el.x as number, (el.y as number) + (el.height as number)],
    [(el.x as number) + (el.width as number), (el.y as number) + (el.height as number)],
    [(el.x as number) + (el.width as number), el.y as number],
  ];
}

function rotatePoints(points: Point[], cx: number, cy: number, angle: number): Point[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

function hasLabel(el: ExcalidrawElement, elements: ExcalidrawElement[]): boolean {
  // bound text
  for (const e of elements) {
    if (e.type === "text" && (e as any).containerId === el.id) {
      const text = (e as any).text as string | undefined;
      if (text && text.trim().length > 0) return true;
    }
  }
  // direct label field (fallback)
  const label = (el as any).label as string | undefined;
  return !!(label && label.trim().length > 0);
}

function toNodeGeom(el: ExcalidrawElement, elements: ExcalidrawElement[]): NodeGeom | null {
  if (!["rectangle", "diamond", "ellipse"].includes(el.type as string)) return null;
  if (!hasLabel(el, elements)) return null;

  let points: Point[];
  if (el.type === "rectangle") points = rectPolygon(el);
  else if (el.type === "diamond") points = diamondPolygon(el);
  else points = ellipsePolygon(el, 24);

  const angle = (el as any).angle as number | undefined;
  if (angle && angle !== 0) {
    const cx = (el.x as number) + (el.width as number) / 2;
    const cy = (el.y as number) + (el.height as number) / 2;
    points = rotatePoints(points, cx, cy, angle);
  }

  const area = polygonArea(points);
  return { id: el.id as string, type: el.type as string, points, area };
}

export function detectOverlaps(elements: ExcalidrawElement[], minArea = 1): OverlapResult[] {
  const geoms: NodeGeom[] = [];
  for (const el of elements) {
    const g = toNodeGeom(el, elements);
    if (g) geoms.push(g);
  }

  const overlaps: OverlapResult[] = [];
  for (let i = 0; i < geoms.length; i++) {
    for (let j = i + 1; j < geoms.length; j++) {
      const a = geoms[i];
      const b = geoms[j];
      const interArea = polygonIntersectionArea(a.points, b.points);
      if (interArea > minArea) {
        const ratio = interArea / Math.min(a.area, b.area);
        overlaps.push({
          a: a.id,
          b: b.id,
          overlapArea: interArea,
          overlapRatio: ratio,
        });
      }
    }
  }
  overlaps.sort((x, y) => y.overlapRatio - x.overlapRatio);
  return overlaps;
}
