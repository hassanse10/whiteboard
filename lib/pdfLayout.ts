export function computePdfPagePositions(
  pages: Array<{ width: number; height: number }>,
  viewport: { scrollX: number; scrollY: number; width: number; height: number },
  gap = 24
): Array<{ x: number; y: number; width: number; height: number }> {
  const totalWidth = pages.reduce((sum, p) => sum + p.width, 0) + (pages.length - 1) * gap;
  const maxHeight = Math.max(...pages.map((p) => p.height));
  const startX = -viewport.scrollX + (viewport.width - totalWidth) / 2;
  const startY = -viewport.scrollY + (viewport.height - maxHeight) / 2;

  const result: Array<{ x: number; y: number; width: number; height: number }> = [];
  let x = startX;
  for (const page of pages) {
    result.push({ x, y: startY, width: page.width, height: page.height });
    x += page.width + gap;
  }
  return result;
}
