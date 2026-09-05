import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'apps/client/public/assets/production/review');
const htmlPath = resolve(outDir, 'rework-queue.html');

const MODES = [
  ['first-slice', 'First Slice', 'first-slice-runtime-metadata.json'],
  ['second-slice', 'Second Slice', 'second-slice-runtime-metadata.json'],
  ['third-slice', 'Third Slice', 'third-slice-runtime-metadata.json'],
  ['fourth-slice', 'Fourth Slice', 'fourth-slice-runtime-metadata.json'],
  ['fifth-slice', 'Fifth Slice', 'fifth-slice-runtime-metadata.json'],
  ['sixth-slice', 'Chapter 1 Finale', 'sixth-slice-runtime-metadata.json'],
  ['chapter-02', 'Chapter 2', 'chapter-02-runtime-metadata.json'],
  ['chapter-03', 'Chapter 3', 'chapter-03-runtime-metadata.json'],
  ['chapter-04', 'Chapter 4', 'chapter-04-runtime-metadata.json'],
  ['special-content', 'Special Content', 'special-content-runtime-metadata.json'],
  ['recruitment', 'Recruitment', 'recruitment-form-runtime-metadata.json'],
].map(([id, label, metadataFile]) => ({ id, label, metadataFile }));

const modePayload = JSON.stringify(MODES).replaceAll('<', '\\u003c');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frontline Summoners · Local Rework Queue</title>
  <style>
    :root{color-scheme:dark;font-family:"Malgun Gothic",system-ui,sans-serif;background:#090d13;color:#edf2f8}
    *{box-sizing:border-box}body{margin:0;background:#090d13;min-height:100vh}.shell{width:min(1480px,calc(100% - 28px));margin:0 auto;padding:20px 0 56px}
    .top{position:sticky;top:0;z-index:40;background:#090d13f2;backdrop-filter:blur(9px);border-bottom:1px solid #283342;padding:12px 0 14px}.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.grow{flex:1}.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8fa0b5}.title{margin:3px 0 0;font-size:25px}.warn{border:1px solid #a8782c;background:#2b2113;color:#ffd78a;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:800}.btn,.filter{appearance:none;border:1px solid #405069;background:#182230;color:#d8e1ec;border-radius:8px;padding:8px 10px;text-decoration:none;cursor:pointer;font-weight:700}.btn:hover,.filter:hover{background:#213047}.btn.primary{background:#d9b35e;color:#191309;border-color:#d9b35e}.filter.active{background:#405a78;border-color:#6684a6}.controls{margin-top:11px}.search{min-width:260px;flex:1;background:#111923;border:1px solid #354255;color:#eaf0f7;border-radius:8px;padding:9px 11px}.metric{font-size:12px;color:#a8b5c5}.metric b{color:#eef3f9}.hint{margin:13px 0 18px;color:#91a0b2;font-size:12px;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid #2d3949;background:#101720;border-radius:12px;padding:14px}.card.blocker{border-color:#9b4b4b;box-shadow:inset 3px 0 #9b4b4b}.card.revisit{border-color:#9a633e;box-shadow:inset 3px 0 #9a633e}.card.gallery-revisit:not(.blocker):not(.revisit){border-color:#5f536d}.card.hidden{display:none}.card-head{display:flex;gap:10px;align-items:flex-start}.name{font-size:15px;font-weight:800;word-break:break-all}.sub{font-size:11px;color:#8999ac;margin-top:3px;word-break:break-all}.badge{font-size:10px;border:1px solid #525f70;border-radius:999px;padding:5px 7px;color:#cbd6e3;white-space:nowrap}.badge.gallery{border-color:#685a76;color:#d5c6e3}.triage{display:grid;grid-template-columns:160px 1fr;gap:10px;margin-top:11px}.triage select,.note{width:100%;background:#0b1119;color:#e5ebf2;border:1px solid #354255;border-radius:7px;padding:8px}.reasons{display:flex;gap:6px 10px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#c2cddb}.reasons label{display:flex;gap:4px;align-items:center}.note{margin-top:10px;min-height:64px;resize:vertical;font:inherit;font-size:12px}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.actions a{font-size:11px;text-decoration:none;border:1px solid #405069;background:#172232;color:#d9e6f5;border-radius:7px;padding:7px 9px;font-weight:800}.empty,.fatal{grid-column:1/-1;padding:60px 18px;text-align:center;color:#98a7ba}.fatal{border:1px solid #7e4141;background:#2a1515;color:#ffc5c5;border-radius:9px}.toast{position:fixed;right:18px;bottom:18px;padding:10px 12px;background:#203047;border:1px solid #4b6686;border-radius:8px;color:#e4eef9;opacity:0;pointer-events:none;transition:opacity .2s}.toast.show{opacity:1}
    @media(max-width:900px){.grid{grid-template-columns:1fr}}@media(max-width:650px){.triage{grid-template-columns:1fr}.search{min-width:100%}.warn{white-space:normal}}
  </style>
</head>
<body>
<div class="shell">
  <div class="top">
    <div class="row">
      <div class="grow"><div class="eyebrow">Frontline Summoners / production art</div><h1 class="title">Local Rework Queue</h1></div>
      <div class="warn">UNAPPROVED · REWORK TRIAGE ONLY</div>
      <a class="btn" href="index.html">← HUB</a>
      <button class="btn primary" id="copy">COPY REWORK JSON</button>
      <button class="btn" id="reset">RESET LOCAL TRIAGE</button>
    </div>
    <div class="row controls">
      <input class="search" id="search" type="search" placeholder="mode / target / asset id 검색" autocomplete="off">
      <button class="filter active" data-filter="all">ALL</button>
      <button class="filter" data-filter="queued">QUEUED</button>
      <button class="filter" data-filter="gallery-revisit">GALLERY REVISIT</button>
      <button class="filter" data-filter="revisit">REVISIT</button>
      <button class="filter" data-filter="blocker">BLOCKER</button>
      <span class="metric" id="metric"></span>
    </div>
  </div>
  <div class="hint">이 페이지는 motion gallery에서 표시한 LOCAL CHECKED / REVISIT를 읽고, 별도의 로컬 재작업 사유를 붙이는 보조 도구다. 모든 값은 이 브라우저 localStorage에만 저장된다. COPY REWORK JSON은 문제 후보를 비권위 초안으로 복사할 뿐 정본 JSON, provenance, review package, runtime authority 또는 사람 승인 상태를 수정하지 않는다.</div>
  <main class="grid" id="grid"></main>
</div>
<div class="toast" id="toast"></div>
<script>
  const MODES=${modePayload};
  const GALLERY_PREFIX='frontline-production-review-gallery-local-v1:';
  const TRIAGE_PREFIX='frontline-production-review-rework-local-v1:';
  const REASONS=[
    ['silhouette','실루엣/형태'],
    ['motion','모션 동세'],
    ['attack-contact','공격 contact 타이밍'],
    ['scale-clipping','크기/클리핑'],
    ['combat-readability','전투 가독성'],
    ['form-distinction','폼 구분'],
    ['other','기타'],
  ];
  const grid=document.getElementById('grid');
  const search=document.getElementById('search');
  const metric=document.getElementById('metric');
  const toast=document.getElementById('toast');
  let activeFilter='all';
  let cards=[];

  function esc(value){return String(value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch];});}
  function galleryKey(modeId,targetKey,kind){return GALLERY_PREFIX+modeId+':'+targetKey+':'+kind;}
  function triageKey(modeId,targetKey,kind){return TRIAGE_PREFIX+modeId+':'+targetKey+':'+kind;}
  function readGallery(modeId,targetKey,kind){return localStorage.getItem(galleryKey(modeId,targetKey,kind))==='1';}
  function readText(modeId,targetKey,kind){return localStorage.getItem(triageKey(modeId,targetKey,kind))||'';}
  function writeText(modeId,targetKey,kind,value){if(value)localStorage.setItem(triageKey(modeId,targetKey,kind),value);else localStorage.removeItem(triageKey(modeId,targetKey,kind));}
  function reasonKey(reason){return 'reason:'+reason;}
  function readReason(modeId,targetKey,reason){return readText(modeId,targetKey,reasonKey(reason))==='1';}
  function flash(message){toast.textContent=message;toast.classList.add('show');setTimeout(function(){toast.classList.remove('show');},1800);}

  function syncCard(card){
    const disposition=card.querySelector('select').value;
    const galleryRevisit=card.dataset.galleryRevisit==='1';
    const hasNote=card.querySelector('textarea').value.trim().length>0;
    const hasReason=Array.from(card.querySelectorAll('[data-reason]')).some(function(input){return input.checked;});
    card.dataset.disposition=disposition;
    card.dataset.queued=(galleryRevisit||disposition||hasNote||hasReason)?'1':'0';
    card.classList.toggle('blocker',disposition==='BLOCKER');
    card.classList.toggle('revisit',disposition==='REVISIT');
    applyFilter();
  }

  function makeCard(mode,targetKey,target){
    const card=document.createElement('article');card.className='card';card.dataset.mode=mode.id;card.dataset.target=targetKey;card.dataset.search=(mode.id+' '+mode.label+' '+targetKey+' '+(target.assetId||'')).toLowerCase();
    const galleryChecked=readGallery(mode.id,targetKey,'checked');
    const galleryRevisit=readGallery(mode.id,targetKey,'revisit');
    card.dataset.galleryRevisit=galleryRevisit?'1':'0';
    card.classList.toggle('gallery-revisit',galleryRevisit);
    const head=document.createElement('div');head.className='card-head';
    const identity=document.createElement('div');identity.className='grow';identity.innerHTML='<div class="name">'+esc(targetKey)+'</div><div class="sub">'+esc(mode.label)+' · '+esc(target.assetId||'no assetId')+'</div>';
    const badges=document.createElement('div');badges.className='row';
    const checked=document.createElement('span');checked.className='badge';checked.textContent=galleryChecked?'GALLERY CHECKED':'GALLERY PENDING';badges.appendChild(checked);
    if(galleryRevisit){const revisit=document.createElement('span');revisit.className='badge gallery';revisit.textContent='GALLERY REVISIT';badges.appendChild(revisit);}
    head.append(identity,badges);card.appendChild(head);

    const triage=document.createElement('div');triage.className='triage';
    const select=document.createElement('select');select.setAttribute('aria-label','local rework disposition');
    [['','NO LOCAL DISPOSITION'],['REVISIT','REVISIT'],['BLOCKER','BLOCKER']].forEach(function(pair){const option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];select.appendChild(option);});
    select.value=readText(mode.id,targetKey,'disposition');
    const reasonWrap=document.createElement('div');reasonWrap.className='reasons';
    REASONS.forEach(function(pair){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.dataset.reason=pair[0];input.checked=readReason(mode.id,targetKey,pair[0]);label.append(input,document.createTextNode(' '+pair[1]));reasonWrap.appendChild(label);});
    triage.append(select,reasonWrap);card.appendChild(triage);
    const note=document.createElement('textarea');note.className='note';note.placeholder='재작업에 필요한 관찰 메모 (로컬 전용)';note.value=readText(mode.id,targetKey,'note');card.appendChild(note);
    const actions=document.createElement('div');actions.className='actions';actions.innerHTML='<a href="gallery.html?mode='+encodeURIComponent(mode.id)+'">OPEN MOTION GALLERY</a><a target="_blank" rel="noopener" href="../../../?productionReview='+encodeURIComponent(mode.id)+'">OPEN BATTLE REVIEW</a>';card.appendChild(actions);

    select.addEventListener('change',function(){writeText(mode.id,targetKey,'disposition',select.value);syncCard(card);});
    note.addEventListener('input',function(){writeText(mode.id,targetKey,'note',note.value);syncCard(card);});
    reasonWrap.querySelectorAll('[data-reason]').forEach(function(input){input.addEventListener('change',function(){writeText(mode.id,targetKey,reasonKey(input.dataset.reason),input.checked?'1':'');syncCard(card);});});
    syncCard(card);return card;
  }

  function applyFilter(){
    const q=search.value.trim().toLowerCase();
    cards.forEach(function(card){
      const disposition=card.dataset.disposition;
      const filterOk=activeFilter==='all'||(activeFilter==='queued'&&card.dataset.queued==='1')||(activeFilter==='gallery-revisit'&&card.dataset.galleryRevisit==='1')||(activeFilter==='revisit'&&disposition==='REVISIT')||(activeFilter==='blocker'&&disposition==='BLOCKER');
      card.classList.toggle('hidden',!(filterOk&&(!q||card.dataset.search.includes(q))));
    });
    const queued=cards.filter(function(card){return card.dataset.queued==='1';}).length;
    const galleryRevisit=cards.filter(function(card){return card.dataset.galleryRevisit==='1';}).length;
    const revisit=cards.filter(function(card){return card.dataset.disposition==='REVISIT';}).length;
    const blocker=cards.filter(function(card){return card.dataset.disposition==='BLOCKER';}).length;
    const visible=cards.filter(function(card){return !card.classList.contains('hidden');}).length;
    metric.innerHTML='<b>'+queued+'</b> queued · <b>'+galleryRevisit+'</b> gallery revisit · <b>'+revisit+'</b> revisit · <b>'+blocker+'</b> blocker · '+visible+' visible';
  }

  function buildDraft(){
    const entries=[];
    cards.forEach(function(card){
      if(card.dataset.queued!=='1')return;
      const modeId=card.dataset.mode,targetKey=card.dataset.target;
      const select=card.querySelector('select');const note=card.querySelector('textarea').value.trim();
      const reasons=Array.from(card.querySelectorAll('[data-reason]')).filter(function(input){return input.checked;}).map(function(input){return input.dataset.reason;});
      entries.push({modeId:modeId,targetKey:targetKey,assetId:card.dataset.assetId||null,galleryChecked:readGallery(modeId,targetKey,'checked'),galleryRevisit:readGallery(modeId,targetKey,'revisit'),localDisposition:select.value||null,reasons:reasons,note:note||null});
    });
    return {schemaVersion:1,kind:'LOCAL_REWORK_TRIAGE_DRAFT',humanApprovalAuthority:false,canonicalWrite:false,approvalEvidence:false,note:'Local review aid only. Requires explicit human review and separate canonical rework processing.',entries:entries};
  }

  async function copyDraft(){
    const payload=buildDraft();
    try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));flash('Rework JSON copied · '+payload.entries.length+' entries');}
    catch(error){flash('Clipboard copy failed');console.error(error);}
  }

  async function boot(){
    try{
      const fragment=document.createDocumentFragment();
      for(const mode of MODES){
        const response=await fetch('../units/'+encodeURIComponent(mode.metadataFile),{cache:'no-store'});if(!response.ok)throw new Error(mode.id+' metadata HTTP '+response.status);const metadata=await response.json();
        for(const pair of Object.entries(metadata.targets||{})){const card=makeCard(mode,pair[0],pair[1]);card.dataset.assetId=pair[1].assetId||'';fragment.appendChild(card);}
      }
      grid.appendChild(fragment);cards=Array.from(grid.querySelectorAll('.card'));applyFilter();
    }catch(error){grid.innerHTML='<div class="fatal">Rework queue metadata load failed: '+esc(error&&error.message?error.message:error)+'</div>';}
  }

  search.addEventListener('input',applyFilter);
  document.querySelectorAll('[data-filter]').forEach(function(button){button.addEventListener('click',function(){activeFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(function(item){item.classList.toggle('active',item===button);});applyFilter();});});
  document.getElementById('copy').addEventListener('click',copyDraft);
  document.getElementById('reset').addEventListener('click',function(){for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&key.startsWith(TRIAGE_PREFIX))localStorage.removeItem(key);}location.reload();});
  boot();
</script>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await writeFile(htmlPath, html);
console.log(`[production-review-rework-queue] materialized local-only triage surface for ${MODES.length} review modes`);
