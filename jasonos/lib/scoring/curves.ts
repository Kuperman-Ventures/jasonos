export function interpolate(curve: [number, number][], x: number): number {
  if (curve.length === 0) return 0;
  const points = [...curve].sort((a, b) => a[0] - b[0]);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i];
    const right = points[i + 1];
    if (!left || !right) continue;
    if (x >= left[0] && x <= right[0]) {
      const span = right[0] - left[0];
      if (span === 0) return right[1];
      const t = (x - left[0]) / span;
      return left[1] + t * (right[1] - left[1]);
    }
  }
  return last[1];
}
