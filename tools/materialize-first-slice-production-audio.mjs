import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const SAMPLE_RATE = 22050;
const ROOT = path.resolve('apps/client/public/assets/production/audio');

function clamp(v) { return Math.max(-1, Math.min(1, v)); }
function env(t, duration, attack = 0.01, release = 0.08) {
  const a = Math.min(1, t / Math.max(0.001, attack));
  const r = Math.min(1, Math.max(0, duration - t) / Math.max(0.001, release));
  return Math.min(a, r);
}
function tone(freq, t, kind = 'sine') {
  const p = 2 * Math.PI * freq * t;
  if (kind === 'square') return Math.sin(p) >= 0 ? 1 : -1;
  if (kind === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p));
  return Math.sin(p);
}
function noise(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) / 0xffffffff) * 2 - 1;
  };
}
function wav(samples) {
  const dataBytes = samples.length * 2;
  const out = Buffer.alloc(44 + dataBytes);
  out.write('RIFF', 0); out.writeUInt32LE(36 + dataBytes, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SAMPLE_RATE, 24); out.writeUInt32LE(SAMPLE_RATE * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(dataBytes, 40);
  samples.forEach((sample, i) => out.writeInt16LE(Math.round(clamp(sample) * 32767), 44 + i * 2));
  return out;
}
function synth(duration, fn) {
  const count = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) samples[i] = clamp(fn(i / SAMPLE_RATE, i));
  return wav(samples);
}
function pulseAt(t, start, duration, freq, amp = 1, kind = 'sine') {
  const local = t - start;
  if (local < 0 || local >= duration) return 0;
  return tone(freq, local, kind) * env(local, duration, 0.008, Math.min(0.12, duration * 0.45)) * amp;
}

const assets = [
  {
    id: 'music:chapter-01', bus: 'MUSIC', rel: 'music/chapter-01/battle-loop.wav', duration: 16,
    intent: '초반 전선의 긴장감은 유지하되 캐릭터/피격 SFX를 덮지 않는 저중역 중심의 짧은 전투 루프',
    make() {
      const bpm = 108; const beat = 60 / bpm; const progression = [146.83, 130.81, 116.54, 130.81];
      const rnd = noise(0x51a7c0de);
      return synth(16, (t, i) => {
        const bar = Math.floor(t / (beat * 4)); const root = progression[bar % progression.length];
        const phase = t % (beat * 4); const chord = [1, 1.1892, 1.4983];
        let v = 0;
        for (let c = 0; c < chord.length; c += 1) v += tone(root * chord[c], t, 'triangle') * 0.075;
        v += tone(root / 2, t, 'sine') * 0.11;
        for (let b = 0; b < 4; b += 1) v += pulseAt(phase, b * beat, 0.12, root * (b % 2 ? 2 : 1), 0.11, 'triangle');
        const beatPhase = t % beat;
        if (beatPhase < 0.055) v += rnd() * (1 - beatPhase / 0.055) * 0.055;
        const half = t % (beat * 2);
        if (half < 0.075) v += tone(58, half, 'sine') * (1 - half / 0.075) * 0.16;
        const fade = Math.min(1, t / 0.3, (16 - t) / 0.3);
        return v * Math.max(0, fade) * 0.88;
      });
    },
  },
  {
    id: 'sfx:battle-core:slash-contact', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/slash-contact.wav', duration: 0.24,
    intent: 'F1/약탈병의 짧은 베기 접촉음',
    make() { const rnd = noise(0x51a501); return synth(0.24, (t) => (tone(760 - t * 1900, t, 'triangle') * 0.18 + rnd() * 0.22) * env(t, 0.24, 0.004, 0.15)); },
  },
  {
    id: 'sfx:battle-core:pierce-contact', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/pierce-contact.wav', duration: 0.22,
    intent: 'F2/F3 창끝과 짧은 무기의 명확한 찌르기 접촉음',
    make() { const rnd = noise(0x51a502); return synth(0.22, (t) => (tone(1180 - t * 2600, t, 'sine') * 0.23 + rnd() * 0.12) * env(t, 0.22, 0.002, 0.12)); },
  },
  {
    id: 'sfx:battle-core:impact-light', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/impact-light.wav', duration: 0.18,
    intent: '일반 유닛 피격의 짧은 천/가죽+둔탁 접촉음',
    make() { const rnd = noise(0x51a503); return synth(0.18, (t) => (tone(150, t, 'sine') * 0.28 + rnd() * 0.17) * env(t, 0.18, 0.002, 0.1)); },
  },
  {
    id: 'sfx:battle-core:impact-heavy', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/impact-heavy.wav', duration: 0.34,
    intent: '보스/강한 넉백의 저역 중심 중량 피격음',
    make() { const rnd = noise(0x51a504); return synth(0.34, (t) => (tone(72 - t * 55, t, 'sine') * 0.42 + tone(142, t, 'triangle') * 0.12 + rnd() * 0.12) * env(t, 0.34, 0.003, 0.22)); },
  },
  {
    id: 'sfx:battle-core:boss-warning', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/boss-warning.wav', duration: 1.05,
    intent: '황금가면 사령술사 등장 경고. 낮은 두 번의 종성 타격 뒤 얇은 금속성 잔향',
    make() { return synth(1.05, (t) => pulseAt(t, 0, 0.55, 92, 0.42) + pulseAt(t, 0.36, 0.62, 73, 0.46) + pulseAt(t, 0.02, 0.82, 584, 0.09, 'triangle') + pulseAt(t, 0.38, 0.62, 438, 0.08, 'triangle')); },
  },
  {
    id: 'sfx:battle-core:boss-void-cast', bus: 'BATTLE_SFX', rel: 'sfx/battle-core/boss-void-cast.wav', duration: 0.72,
    intent: '보스 공격 contact 직전의 역상승 후 저역 붕괴감을 주는 마법 타격음',
    make() { const rnd = noise(0x51a506); return synth(0.72, (t) => { const sweep = 180 + t * 520; const drop = 96 - t * 68; return (tone(sweep, t, 'triangle') * 0.17 + tone(Math.max(38, drop), t, 'sine') * 0.32 + rnd() * 0.07) * env(t, 0.72, 0.035, 0.26); }); },
  },
];

const metadata = { schemaVersion: 1, generatorVersion: 1, reviewStatus: 'UNREVIEWED_RUNTIME_FILES', authorship: 'ORIGINAL_DETERMINISTIC_SYNTHESIS', generativeAiUsed: false, sampleRate: SAMPLE_RATE, assets: {} };
for (const asset of assets) {
  const data = asset.make();
  const target = path.join(ROOT, asset.rel);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  metadata.assets[asset.id] = {
    bus: asset.bus,
    runtimeUrl: `/assets/production/audio/${asset.rel.replaceAll(path.sep, '/')}`,
    durationSeconds: asset.duration,
    bytes: data.byteLength,
    sha256: createHash('sha256').update(data).digest('hex'),
    intent: asset.intent,
  };
}
metadata.evidence = null;
metadata.captures = null;
metadata.humanReview = { status: 'PENDING', reviewer: null, reviewedAt: null };
await writeFile(path.join(ROOT, 'first-slice-audio-runtime-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`materialized ${assets.length} first-slice production audio candidates`);
