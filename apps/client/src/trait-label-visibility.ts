export interface TraitLabelCandidate {
  readonly simulationId: number;
  readonly screenX: number;
  readonly isBoss: boolean;
}

/**
 * Visual-only label selection. Boss labels are always kept; ordinary labels are thinned by
 * screen-space distance so dense waves do not turn into a wall of text. This function never
 * reads or changes simulation state beyond the immutable render candidates supplied to it.
 */
export function selectVisibleTraitLabelIds(
  candidates: readonly TraitLabelCandidate[],
  minimumGap = 76,
): ReadonlySet<number> {
  if (!Number.isFinite(minimumGap) || minimumGap < 0) throw new Error('minimumGap must be a non-negative finite number');
  const sorted = [...candidates].sort((a, b) => a.screenX - b.screenX || a.simulationId - b.simulationId);
  const visible = new Set<number>();
  const occupiedX: number[] = [];

  for (const candidate of sorted) {
    const clear = occupiedX.every((x) => Math.abs(candidate.screenX - x) >= minimumGap);
    if (!candidate.isBoss && !clear) continue;
    visible.add(candidate.simulationId);
    occupiedX.push(candidate.screenX);
  }

  return visible;
}
