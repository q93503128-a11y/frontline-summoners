export type FirstSliceReworkKind = 'MILITIA' | 'RAIDER';

export interface FirstSliceReworkOverlaySpec {
  readonly key: string;
  readonly kind: FirstSliceReworkKind;
  readonly formOrder?: 1 | 2 | 3;
  readonly packWidth: number;
  readonly packHeight: number;
  readonly packOffsetX: number;
  readonly packOffsetY: number;
  readonly weaponLength: number;
  readonly weaponThickness: number;
  readonly stanceDrop: number;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly attackPushMax: number;
  readonly wearMarks: number;
}

const MILITIA_FORMS: Readonly<Record<string, FirstSliceReworkOverlaySpec>> = {
  militia_f1: {
    key: 'militia-f1-first-slice-rework', kind: 'MILITIA', formOrder: 1,
    packWidth: 15, packHeight: 18, packOffsetX: -9, packOffsetY: -5,
    weaponLength: 28, weaponThickness: 3, stanceDrop: 0,
    primaryColor: 0x78634f, secondaryColor: 0x4e4439, accentColor: 0xa48a69,
    attackPushMax: 6, wearMarks: 1,
  },
  militia_f2: {
    key: 'militia-f2-first-slice-rework', kind: 'MILITIA', formOrder: 2,
    packWidth: 18, packHeight: 20, packOffsetX: -10, packOffsetY: -7,
    weaponLength: 34, weaponThickness: 3, stanceDrop: 1,
    primaryColor: 0x655e52, secondaryColor: 0x464a4b, accentColor: 0xb7b9b3,
    attackPushMax: 7, wearMarks: 0,
  },
  militia_f3: {
    key: 'militia-f3-first-slice-rework', kind: 'MILITIA', formOrder: 3,
    packWidth: 14, packHeight: 17, packOffsetX: -8, packOffsetY: -3,
    weaponLength: 24, weaponThickness: 4, stanceDrop: 5,
    primaryColor: 0x5b5147, secondaryColor: 0x37383a, accentColor: 0x8f877c,
    attackPushMax: 8, wearMarks: 3,
  },
};

const RAIDER: FirstSliceReworkOverlaySpec = {
  key: 'enemy-raider-first-slice-rework', kind: 'RAIDER',
  packWidth: 27, packHeight: 25, packOffsetX: -13, packOffsetY: -7,
  weaponLength: 19, weaponThickness: 4, stanceDrop: 2,
  primaryColor: 0x69513f, secondaryColor: 0x3e332b, accentColor: 0xa17450,
  attackPushMax: 6, wearMarks: 4,
};

export function getFirstSliceReworkOverlaySpec(
  unitId: string,
  resolvedFormId?: string,
): FirstSliceReworkOverlaySpec | undefined {
  if (unitId === 'militia') return resolvedFormId ? MILITIA_FORMS[resolvedFormId] : undefined;
  if (unitId === 'enemy-raider' && resolvedFormId === undefined) return RAIDER;
  return undefined;
}

export const FIRST_SLICE_REWORK_TARGET_KEYS = Object.freeze([
  'unit:militia:militia_f1',
  'unit:militia:militia_f2',
  'unit:militia:militia_f3',
  'unit:enemy-raider',
]);
