function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}

/**
 * Replaces role-template evolution entries with authored three-form definitions while
 * preserving the canonical recipe tuples owned by the base catalog.
 */
export function applyExplicitEvolutionFormOverrides(baseValue: unknown, overridesValue: unknown): readonly unknown[] {
  if (!Array.isArray(baseValue)) throw new Error('base evolution catalog must be an array');
  if (!Array.isArray(overridesValue)) throw new Error('explicit evolution form overrides must be an array');

  const baseIds = new Set(baseValue.map((entry, index) => nonEmptyString(record(entry, `baseEvolutionCatalog[${index}]`).id, `baseEvolutionCatalog[${index}].id`)));
  const overrides = new Map<string, { readonly forms: readonly unknown[]; readonly names: readonly string[] }>();

  for (let index = 0; index < overridesValue.length; index += 1) {
    const raw = record(overridesValue[index], `explicitEvolutionOverrides[${index}]`);
    const characterId = nonEmptyString(raw.characterId, `explicitEvolutionOverrides[${index}].characterId`);
    if (!baseIds.has(characterId)) throw new Error(`explicit evolution override references unknown character: ${characterId}`);
    if (overrides.has(characterId)) throw new Error(`duplicate explicit evolution override: ${characterId}`);
    if (!Array.isArray(raw.forms) || raw.forms.length !== 3) throw new Error(`${characterId} explicit evolution override must contain three forms`);

    const names = raw.forms.map((entry, formIndex) => {
      const form = record(entry, `${characterId}.forms[${formIndex}]`);
      const formOrder = form.formOrder;
      if (!Number.isInteger(formOrder) || formOrder !== formIndex + 1) throw new Error(`${characterId} explicit override forms must be ordered 1,2,3`);
      nonEmptyString(form.formId, `${characterId}.forms[${formIndex}].formId`);
      nonEmptyString(form.description, `${characterId}.forms[${formIndex}].description`);
      record(form.modifiers ?? {}, `${characterId}.forms[${formIndex}].modifiers`);
      return nonEmptyString(form.name, `${characterId}.forms[${formIndex}].name`);
    });
    overrides.set(characterId, { forms: raw.forms, names });
  }

  return baseValue.map((entry, index) => {
    const raw = record(entry, `baseEvolutionCatalog[${index}]`);
    const id = nonEmptyString(raw.id, `baseEvolutionCatalog[${index}].id`);
    const override = overrides.get(id);
    if (!override) return entry;
    return {
      ...raw,
      names: override.names,
      template: 'EXPLICIT',
      forms: override.forms,
    };
  });
}
