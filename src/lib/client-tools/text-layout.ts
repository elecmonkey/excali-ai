let redrawPromise: Promise<((...args: any[]) => void) | null> | null = null;

async function loadRedraw() {
  if (!redrawPromise) {
    redrawPromise = import("@excalidraw/excalidraw")
      .then((m: any) => m.redrawTextBoundingBox as ((...args: any[]) => void) | undefined || null)
      .catch(() => null);
  }
  return redrawPromise;
}

export async function tryRedrawBoundText(
  textEl: any,
  container: any,
  elements: any[]
): Promise<boolean> {
  const redraw = await loadRedraw();
  if (!redraw) return false;
  try {
    const map = new Map<string, any>();
    for (const el of elements) {
      if (el && el.id) map.set(el.id, el);
    }
    redraw(textEl, container, map, false);
    return true;
  } catch {
    return false;
  }
}
