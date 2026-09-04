import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=resolve(root,'apps/client/public');
const metadataPath=resolve(publicRoot,'assets/production/units/second-slice-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const target=metadata.targets?.['enemy-shield'];
const MOTIONS=['idle','move','attack','knockback','death'];
function assert(ok,msg){if(!ok)throw new Error(`[second-slice-priority-polish] ${msg}`);}
assert(target?.assetId==='unit:enemy-shield'&&target.reviewStatus==='UNREVIEWED_RUNTIME_FILES','enemy-shield metadata missing or review boundary drift');
function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function draw(frame,w,h,motion,i,n){const t=i/Math.max(1,n-1),bob=motion==='move'?(i%2?-3:3):motion==='knockback'?Math.round(t*8):motion==='death'?Math.round(t*13):0,pulse=motion==='attack'?Math.sin(t*Math.PI):0,lean=motion==='move'?(i%2?-7:7):motion==='attack'?Math.round(pulse*10):0,cx=Math.round(w*.46),cy=Math.round(h*.49)+bob;const dark=[48,55,64,255],mid=[93,108,119,255],light=[190,201,202,255],accent=[181,103,66,255],glow=[105,188,214,255];
  // Large asymmetric tower shield: deliberately distinct from circular wheel silhouettes.
  rect(frame,w,h,cx-71+lean,cy-50,cx-24+lean,cy+47,dark,.97);rect(frame,w,h,cx-64+lean,cy-43,cx-31+lean,cy+39,light,.94);
  triangle(frame,w,h,[cx-71+lean,cy-50],[cx-48+lean,cy-76],[cx-24+lean,cy-50],mid,.95);
  triangle(frame,w,h,[cx-71+lean,cy+47],[cx-49+lean,cy+66],[cx-24+lean,cy+47],mid,.94);
  rect(frame,w,h,cx-57+lean,cy-15,cx-39+lean,cy+13,accent,.88);ellipse(frame,w,h,cx-48+lean,cy-1,7,7,glow,.8);
  if(motion==='move'){line(frame,w,h,cx-15,cy+29,cx+20+(i%2?7:-6),cy+53,dark,9,.93);line(frame,w,h,cx+7,cy+28,cx+40+(i%2?-6:7),cy+50,dark,9,.93);}
  if(motion==='attack'){const reach=Math.round(26+50*pulse);line(frame,w,h,cx+20,cy-9,Math.min(w-8,cx+55+reach),cy-23,dark,9,.96);triangle(frame,w,h,[Math.min(w-10,cx+53+reach),cy-25],[Math.min(w-4,cx+72+reach),cy-21],[Math.min(w-10,cx+54+reach),cy-12],accent,.92);}
}
for(const motion of MOTIONS){const mm=target.motions[motion];assert(mm?.url&&mm.frameWidth&&mm.frameHeight&&mm.frames,`enemy-shield/${motion} metadata incomplete`);const path=resolve(publicRoot,mm.url.slice(1)),bytes=await readFile(path),png=decodePng(bytes,`enemy-shield/${motion}`);assert(png.width===mm.frameWidth*mm.frames&&png.height===mm.frameHeight,`enemy-shield/${motion} dimensions drift`);const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,mm.frameWidth,mm.frameHeight,i);draw(frame,mm.frameWidth,mm.frameHeight,motion,i,mm.frames);frames.push(frame);}const encoded=encodePng(mm.frameWidth*mm.frames,mm.frameHeight,assemble(frames,mm.frameWidth,mm.frameHeight));await writeFile(path,encoded);mm.sha256=sha256(encoded);mm.bytes=encoded.length;}
target.visualPolishPriority02={version:1,kind:'ASYMMETRIC_TOWER_SHIELD_AND_MOVE_READABILITY',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
metadata.visualPolishPriority02={version:1,target:'enemy-shield',humanReview:'PENDING'};
await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log('[second-slice-priority-polish] polished enemy-shield silhouette and movement readability');
