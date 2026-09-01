export interface VisualFormProgressEntry {
  readonly selectedFormId?: string;
}

let selectedFormByCharacterId = new Map<string, string>();

/** Presentation-only mirror of the active save's form selection. It never writes progression or simulation state. */
export function syncActiveVisualForms(progressByCharacterId: Readonly<Record<string, VisualFormProgressEntry>> | undefined): void {
  const next = new Map<string, string>();
  for (const [characterId, progress] of Object.entries(progressByCharacterId ?? {})) {
    if (typeof progress.selectedFormId === 'string' && progress.selectedFormId.length > 0) next.set(characterId, progress.selectedFormId);
  }
  selectedFormByCharacterId = next;
}

export function getActiveVisualFormId(characterId: string): string | undefined {
  return selectedFormByCharacterId.get(characterId);
}

export function clearActiveVisualForms(): void {
  selectedFormByCharacterId = new Map();
}
