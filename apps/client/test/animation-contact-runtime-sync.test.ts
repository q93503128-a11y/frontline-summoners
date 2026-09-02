import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildCharacterCombatSlot, EVOLUTION_FORMS } from '../src/character-growth.ts';
import { ALL_PLAYER_SLOTS } from '../src/prototype.ts';

const DOC_PATH = fileURLToPath(new URL('../../../docs/content-wiki/systems/ANIMATION_CONTACT_FRAME_TARGETS.md', import.meta.url));

function parseFrameCell(value: string): readonly number[] {
  const cleaned = value.replaceAll('**', '').trim();
  const matches = [...cleaned.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (matches.length === 0) throw new Error(`contact table cell contains no frames: ${value}`);
  return matches;
}

function contactRows(markdown: string): readonly { readonly displayName: string; readonly frames: readonly (readonly number[])[] }[] {
  const rows: { displayName: string; frames: readonly (readonly number[])[] }[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('| ')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 5 || cells[0] === '캐릭터' || cells[0] === '---') continue;
    if (!/F/.test(cells[1] ?? '') || !/F/.test(cells[2] ?? '') || !/F/.test(cells[3] ?? '')) continue;
    rows.push({
      displayName: cells[0]!,
      frames: [parseFrameCell(cells[1]!), parseFrameCell(cells[2]!), parseFrameCell(cells[3]!)],
    });
  }
  return rows;
}

function runtimeFramesForSlot(slotId: string): readonly (readonly number[])[] {
  const slot = ALL_PLAYER_SLOTS.find((candidate) => candidate.slotId === slotId);
  if (!slot) throw new Error(`unknown roster slot: ${slotId}`);
  const forms = EVOLUTION_FORMS
    .filter((form) => form.characterId === slotId)
    .sort((a, b) => a.formOrder - b.formOrder);
  assert.equal(forms.length, 3, `${slotId} must have exactly F1/F2/F3`);
  return forms.map((form) => [...buildCharacterCombatSlot(slot, 1, form.formId).definition.attackTiming.hitFrames]);
}

test('all 43 contact-table rows match current F1/F2/F3 runtime hit frames', () => {
  const rows = contactRows(readFileSync(DOC_PATH, 'utf8'));
  assert.equal(rows.length, 43, 'contact document must cover all 43 initial player characters');
  assert.equal(ALL_PLAYER_SLOTS.length, 43);

  const mismatches: string[] = [];
  const seenSlotIds = new Set<string>();
  for (const row of rows) {
    const slot = ALL_PLAYER_SLOTS.find((candidate) => candidate.displayName === row.displayName);
    if (!slot) {
      mismatches.push(`${row.displayName}: no current roster slot uses this F1 display name`);
      continue;
    }
    if (seenSlotIds.has(slot.slotId)) {
      mismatches.push(`${row.displayName}: duplicate contact row for ${slot.slotId}`);
      continue;
    }
    seenSlotIds.add(slot.slotId);
    const actual = runtimeFramesForSlot(slot.slotId);
    for (let formIndex = 0; formIndex < 3; formIndex += 1) {
      const documented = [...row.frames[formIndex]!];
      const runtime = [...actual[formIndex]!];
      if (documented.length !== runtime.length || documented.some((frame, index) => frame !== runtime[index])) {
        mismatches.push(`${row.displayName} F${formIndex + 1}: doc ${documented.join('/')}F != runtime ${runtime.join('/')}F`);
      }
    }
  }

  for (const slot of ALL_PLAYER_SLOTS) {
    if (!seenSlotIds.has(slot.slotId)) mismatches.push(`${slot.displayName}: missing contact row for ${slot.slotId}`);
  }
  assert.deepEqual(mismatches, []);
});
