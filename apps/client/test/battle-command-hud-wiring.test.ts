import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('accessible battle installs the presentation-only command HUD before the authoritative battle create path', async () => {
  const source = await readSource('../src/accessible-battle-scene.ts');
  assert.match(source, /import \{ installBattleCommandHud \} from '\.\/battle-command-hud\.ts';/);
  const installIndex = source.indexOf('installBattleCommandHud(this);');
  const superIndex = source.indexOf('super.create();');
  assert.ok(installIndex >= 0);
  assert.ok(superIndex > installIndex);
});

test('command HUD replaces only drawing surfaces and keeps simulation, trusted logging, and sync authority in BattleScene', async () => {
  const source = await readSource('../src/battle-command-hud.ts');
  assert.match(source, /carrier\.drawHud = \(\): void => installTopCommandRail\(carrier\);/);
  assert.match(source, /carrier\.drawUnitButtons = \(\): void => installProductionRail\(carrier\);/);
  assert.doesNotMatch(source, /trySpawnPlayerUnit|tryUpgradeSupply\(|tryFireBaseWeapon\(|stepPlayableBattle|TrustedBattleCommandRecorder/);
  assert.doesNotMatch(source, /syncHud\s*\(/);
  assert.match(source, /scene\.buttons\.set\(slot\.slotId, \{ bg, shade, cooldown, cost \}\);/);
});

test('battle production rail favors one-row 1-0 scanning and reflows only when real CSS touch targets no longer fit', async () => {
  const source = await readSource('../src/battle-command-hud.ts');
  assert.match(source, /getCurrentMinimumInternalTouchTarget\(\)/);
  assert.match(source, /const singleRowSlotWidth = Math\.max\(82, minimumTouch\);/);
  assert.match(source, /const useTwoRows = compact && singleRowSlotWidth \* 10 \+ 36 > 870;/);
  assert.match(source, /const columns = useTwoRows \? 5 : 10;/);
  assert.match(source, /Math\.max\(456, 720 - \(slotHeight \* 2 \+ rowGap \+ 12\)\)/);
  assert.match(source, /if \(!compact\) \{[\s\S]*?getUnitHotkeyLabel\(index\)/);
});

test('supply and base weapon remain separate commands with desktop Q-E vocabulary and compact touch vocabulary', async () => {
  const source = await readSource('../src/battle-command-hud.ts');
  assert.match(source, /compact \? '보급소' : 'Q · 보급소'/);
  assert.match(source, /compact \? `\$\{weaponName\} · 사용 가능` : `E · \$\{weaponName\} · 사용 가능`/);
  assert.match(source, /scene\.tryUpgradeSupplyInput\(\)/);
  assert.match(source, /scene\.tryFireBaseWeaponInput\(\)/);
  assert.match(source, /scene\.supplyBar = scene\.add\.rectangle\(938/);
  assert.match(source, /scene\.baseWeaponBg = scene\.add\.rectangle\(weaponX/);
});
