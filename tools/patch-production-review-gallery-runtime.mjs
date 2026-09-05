import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/client/public/assets/production/review/gallery.html');
let html = await readFile(htmlPath, 'utf8');

function replaceOnce(from, to, label) {
  const first = html.indexOf(from);
  if (first < 0) throw new Error(`[production-review-gallery-patch] missing ${label}`);
  if (html.indexOf(from, first + from.length) >= 0) throw new Error(`[production-review-gallery-patch] duplicate ${label}`);
  html = html.replace(from, to);
}

replaceOnce(
  '      <a class="btn primary" id="battle" href="../../../">OPEN BATTLE REVIEW</a>',
  '      <a class="btn" id="compare" href="compare.html">COMPARE LAB</a>\n      <a class="btn primary" id="battle" href="../../../">OPEN BATTLE REVIEW</a>',
  'compare navigation insertion point',
);

replaceOnce(
  "  const battle=document.getElementById('battle');",
  "  const battle=document.getElementById('battle');\n  const compare=document.getElementById('compare');",
  'compare element binding',
);

replaceOnce(
  `  function makeMotion(target,motionName,motion){
    const box=document.createElement('div');box.className='motion';
    const head=document.createElement('div');head.className='motion-head';
    head.innerHTML='<strong>'+esc(motionName)+'</strong><span>'+motion.frames+'f · '+motion.frameWidth+'×'+motion.frameHeight+'</span>';
    const stage=document.createElement('div');stage.className='stage';
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=150;
    canvas.dataset.url=motion.url;canvas.dataset.frames=String(motion.frames);canvas.dataset.frameWidth=String(motion.frameWidth);canvas.dataset.frameHeight=String(motion.frameHeight);canvas.dataset.motion=motionName;canvas.dataset.contact=String(target.attackContactFrame??-1);
    stage.appendChild(canvas);box.appendChild(head);box.appendChild(stage);return box;
  }`,
  `  function publicUrlFromFile(file){
    const prefix='apps/client/public/';
    return typeof file==='string'&&file.startsWith(prefix)?'/'+file.slice(prefix.length):null;
  }

  function resolveMotion(target,motionName,motion){
    const fileUrl=publicUrlFromFile(motion.file);
    const recruitmentFallback=modeId==='recruitment'&&target.unitId&&target.formId?'/assets/production/units/'+target.unitId+'/'+target.formId+'/'+motionName+'.png':null;
    const url=motion.url||fileUrl||recruitmentFallback;const frameWidth=Number(motion.frameWidth??target.frameWidth);const frameHeight=Number(motion.frameHeight??target.frameHeight);const frames=Number(motion.frames);
    if(!url||!Number.isFinite(frameWidth)||frameWidth<=0||!Number.isFinite(frameHeight)||frameHeight<=0||!Number.isInteger(frames)||frames<=0)throw new Error('unresolvable runtime strip '+motionName+' for '+(target.assetId||'target'));
    return {url:url,frameWidth:frameWidth,frameHeight:frameHeight,frames:frames};
  }

  function makeMotion(target,motionName,motion){
    const resolved=resolveMotion(target,motionName,motion);
    const box=document.createElement('div');box.className='motion';
    const head=document.createElement('div');head.className='motion-head';
    head.innerHTML='<strong>'+esc(motionName)+'</strong><span>'+resolved.frames+'f · '+resolved.frameWidth+'×'+resolved.frameHeight+'</span>';
    const stage=document.createElement('div');stage.className='stage';
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=150;
    canvas.dataset.url=resolved.url;canvas.dataset.frames=String(resolved.frames);canvas.dataset.frameWidth=String(resolved.frameWidth);canvas.dataset.frameHeight=String(resolved.frameHeight);canvas.dataset.motion=motionName;canvas.dataset.contact=String(target.attackContactFrame??-1);
    stage.appendChild(canvas);box.appendChild(head);box.appendChild(stage);return box;
  }`,
  'runtime strip resolver',
);

replaceOnce(
  "    local.append(doneLabel,revisitLabel);head.append(identity,local);card.appendChild(head);",
  "    const compareLink=document.createElement('a');compareLink.className='btn';compareLink.textContent='COMPARE';compareLink.href='compare.html?mode='+encodeURIComponent(modeId)+'&a='+encodeURIComponent(targetKey);\n    local.append(doneLabel,revisitLabel,compareLink);head.append(identity,local);card.appendChild(head);",
  'per-target compare link',
);

replaceOnce(
  "    title.textContent=mode.label+' · Motion Review Gallery';battle.href='../../../?productionReview='+encodeURIComponent(mode.id);",
  "    title.textContent=mode.label+' · Motion Review Gallery';compare.href='compare.html?mode='+encodeURIComponent(mode.id);battle.href='../../../?productionReview='+encodeURIComponent(mode.id);",
  'compare mode route',
);

await writeFile(htmlPath, html);
console.log('[production-review-gallery-patch] added comparison routes and runtime-safe url/file/recruitment strip resolution');
