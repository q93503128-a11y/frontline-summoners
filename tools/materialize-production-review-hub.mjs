import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
const outDir = resolve(root, 'apps/client/public/assets/production/review');
const manifestPath = resolve(outDir, 'production-review-master.json');
const htmlPath = resolve(outDir, 'index.html');

const MODES = [
  { id: 'first-slice', label: 'First Slice', note: '제1장 초기 production 후보', metadataFile: 'first-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/first-slice-production-review-runtime.ts' },
  { id: 'second-slice', label: 'Second Slice', note: '제1장 전선 확장 production 후보', metadataFile: 'second-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/second-slice-production-review-runtime.ts' },
  { id: 'third-slice', label: 'Third Slice', note: 'Duelist · Lancer · Battlemage production 후보', metadataFile: 'third-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/third-slice-production-review-runtime.ts' },
  { id: 'fourth-slice', label: 'Fourth Slice', note: 'Pyromancer · Royal production 후보', metadataFile: 'fourth-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/fourth-slice-production-review-runtime.ts' },
  { id: 'fifth-slice', label: 'Fifth Slice', note: 'Heretic · Cultist · Sprinter production 후보', metadataFile: 'fifth-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/fifth-slice-production-review-runtime.ts' },
  { id: 'sixth-slice', label: 'Chapter 1 Finale', note: 'Voidsage · 제1장 최종 보스 production 후보', metadataFile: 'sixth-slice-runtime-metadata.json', runtimeFile: 'apps/client/src/sixth-slice-production-review-runtime.ts' },
  { id: 'chapter-02', label: 'Chapter 2', note: '제2장 전체 신규 적/보스 production 후보', metadataFile: 'chapter-02-runtime-metadata.json', runtimeFile: 'apps/client/src/chapter-02-production-review-runtime.ts' },
  { id: 'chapter-03', label: 'Chapter 3', note: '제3장 전체 신규 적/보스 production 후보', metadataFile: 'chapter-03-runtime-metadata.json', runtimeFile: 'apps/client/src/chapter-03-production-review-runtime.ts' },
  { id: 'chapter-04', label: 'Chapter 4', note: '제4장 전체 신규 적/보스 production 후보', metadataFile: 'chapter-04-runtime-metadata.json', runtimeFile: 'apps/client/src/chapter-04-production-review-runtime.ts' },
  { id: 'special-content', label: 'Special Content', note: 'Challenge · Resource · Event · Permanent production 후보', metadataFile: 'special-content-runtime-metadata.json', runtimeFile: 'apps/client/src/special-content-production-review-runtime.ts' },
  { id: 'recruitment', label: 'Recruitment', note: '33 캐릭터 · F1/F2/F3 canonical form production 후보', metadataFile: 'recruitment-form-runtime-metadata.json', runtimeFile: 'apps/client/src/recruitment-production-review-runtime.ts' },
];

function countStrips(metadata) {
  let total = 0;
  for (const target of Object.values(metadata.targets ?? {})) {
    total += Object.keys(target.motions ?? {}).length;
  }
  return total;
}

function normalizedReviewState(metadata) {
  if (metadata.humanReview === 'PENDING') return 'PENDING';
  if (metadata.reviewStatus === 'PENDING') return 'PENDING';
  if (metadata.reviewStatus === 'UNREVIEWED_RUNTIME_FILES') return 'UNREVIEWED_RUNTIME_FILES';
  if (metadata.status === 'UNREVIEWED_RUNTIME_FILES') return 'UNREVIEWED_RUNTIME_FILES';
  return metadata.humanReview ?? metadata.reviewStatus ?? metadata.status ?? 'UNSPECIFIED';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const audit = JSON.parse(await readFile(resolve(unitsRoot, 'production-art-quality-audit.json'), 'utf8'));
const modeRecords = [];
for (const mode of MODES) {
  const metadata = JSON.parse(await readFile(resolve(unitsRoot, mode.metadataFile), 'utf8'));
  const targetCount = Object.keys(metadata.targets ?? {}).length;
  const stripCount = countStrips(metadata);
  modeRecords.push({
    ...mode,
    route: `?productionReview=${mode.id}`,
    targetCount,
    stripCount,
    reviewState: normalizedReviewState(metadata),
    normalRuntimeAuthoritative: metadata.normalRuntimeAuthoritative ?? false,
    generativeAiUsed: metadata.generativeAiUsed ?? false,
    sourcePolicy: metadata.sourcePolicy ?? null,
  });
}

const manifest = {
  schemaVersion: 1,
  generatedBy: 'tools/materialize-production-review-hub.mjs',
  reviewHubPath: '/assets/production/review/index.html',
  humanApprovalAuthority: false,
  note: 'This hub is a navigation and local checklist surface only. It is not review evidence and cannot grant approval.',
  audit: {
    auditKind: audit.auditKind,
    humanApprovalAuthority: audit.humanApprovalAuthority,
    summary: audit.summary,
  },
  modes: modeRecords,
};

const summary = audit.summary;
const cards = modeRecords.map((mode) => `
      <article class="card" data-mode="${escapeHtml(mode.id)}">
        <div class="card-head">
          <div>
            <div class="eyebrow">${escapeHtml(mode.id)}</div>
            <h2>${escapeHtml(mode.label)}</h2>
          </div>
          <span class="state">${escapeHtml(mode.reviewState)}</span>
        </div>
        <p>${escapeHtml(mode.note)}</p>
        <div class="stats"><span>${mode.targetCount} targets/forms</span><span>${mode.stripCount} strips</span></div>
        <div class="checks">
          <label><input type="checkbox" data-check="silhouette"> 실루엣/형태 구분</label>
          <label><input type="checkbox" data-check="motion"> idle · move · attack 동세</label>
          <label><input type="checkbox" data-check="scale"> 크기 · 겹침 · 클리핑</label>
          <label><input type="checkbox" data-check="context"> 실전 배경/전투 문맥 가독성</label>
        </div>
        <a class="open" target="_blank" rel="noopener" href="../../../${escapeHtml(mode.route)}">OPEN REVIEW MODE</a>
      </article>`).join('');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frontline Summoners · Production Review Hub</title>
  <style>
    :root{color-scheme:dark;font-family:"Malgun Gothic",system-ui,sans-serif;background:#0c1017;color:#edf1f7}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#202a38 0,#0c1017 48%,#080b10 100%);min-height:100vh}
    main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:36px 0 60px}.top{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:22px}
    h1{font-size:34px;margin:4px 0 8px}.sub{color:#aab5c6;max-width:760px;line-height:1.6}.warning{border:1px solid #b98738;background:#2d2415;color:#ffd98d;padding:11px 14px;border-radius:10px;font-weight:700;white-space:nowrap}
    .audit{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:20px 0 28px}.metric{background:#151c26;border:1px solid #303b4b;border-radius:10px;padding:12px}.metric b{display:block;font-size:24px}.metric span{font-size:12px;color:#98a6b9}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:#121923;border:1px solid #2c3849;border-radius:14px;padding:18px;box-shadow:0 10px 26px #0005}.card-head{display:flex;justify-content:space-between;gap:14px}.eyebrow{font-size:11px;letter-spacing:.12em;color:#8fa3bd;text-transform:uppercase}.card h2{margin:4px 0 0;font-size:22px}.card p{color:#aab5c6;min-height:42px;line-height:1.5}.state{font-size:11px;border:1px solid #806d42;background:#2a251a;color:#f3d58f;border-radius:999px;padding:6px 9px;height:max-content}.stats{display:flex;gap:8px;margin:12px 0}.stats span{background:#1d2734;border-radius:999px;padding:6px 9px;font-size:12px;color:#c7d2e0}.checks{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin:14px 0 18px;color:#cbd4df;font-size:13px}.checks label{display:flex;gap:7px;align-items:flex-start}.checks input{margin-top:2px}.open{display:inline-block;text-decoration:none;background:#d6b15a;color:#17130a;font-weight:800;border-radius:8px;padding:10px 13px}.open:hover{filter:brightness(1.08)}
    footer{margin-top:24px;border-top:1px solid #283240;padding-top:18px;color:#8d9aad;font-size:12px;line-height:1.6}.reset{margin-top:10px;background:#202a37;color:#d9e1eb;border:1px solid #435067;border-radius:8px;padding:8px 11px;cursor:pointer}
    @media(max-width:820px){.top{display:block}.warning{display:inline-block;margin-top:12px}.audit{grid-template-columns:repeat(3,1fr)}.grid{grid-template-columns:1fr}.checks{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <section class="top">
    <div><div class="eyebrow">Frontline Summoners / 전선소환전</div><h1>Production Art · Human Review Hub</h1><div class="sub">자동 구조/품질 검사를 통과한 production 후보를 한 곳에서 여는 검수용 인덱스다. 아래 체크박스는 이 브라우저의 로컬 진행 메모일 뿐이며 provenance, reviewer, reviewedAt 또는 human approval 증거가 아니다.</div></div>
    <div class="warning">UNAPPROVED · HUMAN REVIEW REQUIRED</div>
  </section>
  <section class="audit" aria-label="machine audit summary">
    <div class="metric"><b>${summary.totalTargets}</b><span>audited targets</span></div>
    <div class="metric"><b>${summary.totalStripsAudited}</b><span>audited strips</span></div>
    <div class="metric"><b>${summary.severe}</b><span>severe</span></div>
    <div class="metric"><b>${summary.atRisk}</b><span>at risk</span></div>
    <div class="metric"><b>${summary.weakEvolution}</b><span>weak evolution</span></div>
    <div class="metric"><b>${summary.watchEvolution}</b><span>watch evolution</span></div>
  </section>
  <section class="grid">${cards}
  </section>
  <footer>
    <strong>NOT APPROVAL EVIDENCE.</strong> 이 페이지는 review mode 탐색과 개인 로컬 체크만 제공한다. 체크 상태는 localStorage에만 저장되며 정본 JSON, provenance, review package, reviewer identity 또는 승인 상태를 수정하지 않는다.<br>
    Machine audit: severe ${summary.severe} · atRisk ${summary.atRisk} · weakEvolution ${summary.weakEvolution} · watchEvolution ${summary.watchEvolution} · clippingRisk ${summary.clippingRisk}.
    <br><button class="reset" id="reset">로컬 체크 초기화</button>
  </footer>
</main>
<script>
  const prefix='frontline-production-review-local-v1:';
  for(const card of document.querySelectorAll('[data-mode]')){
    const mode=card.dataset.mode;
    for(const input of card.querySelectorAll('input[data-check]')){
      const key=prefix+mode+':'+input.dataset.check;
      input.checked=localStorage.getItem(key)==='1';
      input.addEventListener('change',()=>localStorage.setItem(key,input.checked?'1':'0'));
    }
  }
  document.getElementById('reset').addEventListener('click',()=>{
    for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&key.startsWith(prefix))localStorage.removeItem(key)}
    for(const input of document.querySelectorAll('input[data-check]'))input.checked=false;
  });
</script>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(htmlPath, html);
console.log(`[production-review-hub] materialized ${modeRecords.length} modes / ${modeRecords.reduce((sum, mode) => sum + mode.stripCount, 0)} listed strips`);
