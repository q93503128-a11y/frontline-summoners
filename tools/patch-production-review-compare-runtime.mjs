import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/client/public/assets/production/review/compare.html');
let html = await readFile(htmlPath, 'utf8');

const from = `  function resolveMotion(target,motionName){
    const motion=target.motions&&target.motions[motionName];if(!motion)throw new Error('missing motion '+motionName);
    const fallback=modeId==='recruitment'&&target.unitId&&target.formId?'/assets/production/units/'+target.unitId+'/'+target.formId+'/'+motionName+'.png':null;
    const url=motion.url||fallback;const frameWidth=Number(motion.frameWidth??target.frameWidth);const frameHeight=Number(motion.frameHeight??target.frameHeight);const frames=Number(motion.frames);
    if(!url||!Number.isFinite(frameWidth)||frameWidth<=0||!Number.isFinite(frameHeight)||frameHeight<=0||!Number.isInteger(frames)||frames<=0)throw new Error('unresolvable runtime strip '+motionName+' for '+(target.assetId||'target'));
    return {url,frameWidth,frameHeight,frames};
  }`;

const to = `  function publicUrlFromFile(file){
    const prefix='apps/client/public/';
    return typeof file==='string'&&file.startsWith(prefix)?'/'+file.slice(prefix.length):null;
  }
  function resolveMotion(target,motionName){
    const motion=target.motions&&target.motions[motionName];if(!motion)throw new Error('missing motion '+motionName);
    const fileUrl=publicUrlFromFile(motion.file);
    const recruitmentFallback=modeId==='recruitment'&&target.unitId&&target.formId?'/assets/production/units/'+target.unitId+'/'+target.formId+'/'+motionName+'.png':null;
    const url=motion.url||fileUrl||recruitmentFallback;const frameWidth=Number(motion.frameWidth??target.frameWidth);const frameHeight=Number(motion.frameHeight??target.frameHeight);const frames=Number(motion.frames);
    if(!url||!Number.isFinite(frameWidth)||frameWidth<=0||!Number.isFinite(frameHeight)||frameHeight<=0||!Number.isInteger(frames)||frames<=0)throw new Error('unresolvable runtime strip '+motionName+' for '+(target.assetId||'target'));
    return {url,frameWidth,frameHeight,frames};
  }`;

const first = html.indexOf(from);
if (first < 0) throw new Error('[production-review-compare-patch] runtime resolver insertion point missing');
if (html.indexOf(from, first + from.length) >= 0) throw new Error('[production-review-compare-patch] duplicate runtime resolver insertion point');
html = html.replace(from, to);

await writeFile(htmlPath, html);
console.log('[production-review-compare-patch] added runtime-safe url/file/recruitment strip resolution');
