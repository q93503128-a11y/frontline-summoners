import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitRoot = resolve(root, 'apps/client/public/assets/production/units');
const outputRoot = resolve(root, 'assets/raw/production/review/vertical-slice-01/preflight');
const metadataPath = resolve(unitRoot, 'first-slice-runtime-metadata.json');
const TARGET_ORDER = ['militia/militia_f1','militia/militia_f2','militia/militia_f3','enemy-raider','enemy-boss'];
const MOTIONS = ['idle','move','attack','knockback','death'];

function fail(message) { throw new Error(`[first-slice review preflight] ${message}`); }
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(bytes,label){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)fail(`${label} is not PNG`);
  let off=8,w=0,h=0,bit=0,type=0,interlace=0;const idat=[];
  while(off+12<=bytes.length){const len=bytes.readUInt32BE(off),kind=bytes.toString('ascii',off+4,off+8),data=bytes.subarray(off+8,off+8+len);off+=12+len;if(kind==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);bit=data[8];type=data[9];interlace=data[12];}else if(kind==='IDAT')idat.push(data);else if(kind==='IEND')break;}
  if(bit!==8||interlace!==0)fail(`${label} unsupported PNG encoding`);
  const ch=type===6?4:type===2?3:type===4?2:type===0?1:0;if(!ch)fail(`${label} unsupported PNG colorType=${type}`);
  const row=w*ch,raw=inflateSync(Buffer.concat(idat)),scan=Buffer.alloc(row*h);let src=0;
  for(let y=0;y<h;y++){const f=raw[src++],cur=scan.subarray(y*row,(y+1)*row),prev=y?scan.subarray((y-1)*row,y*row):null;for(let x=0;x<row;x++){const v=raw[src++],l=x>=ch?cur[x-ch]:0,u=prev?prev[x]:0,ul=prev&&x>=ch?prev[x-ch]:0;cur[x]=f===0?v:f===1?(v+l)&255:f===2?(v+u)&255:f===3?(v+Math.floor((l+u)/2))&255:f===4?(v+paeth(l,u,ul))&255:fail(`${label} invalid filter ${f}`);}}
  const rgba=Buffer.alloc(w*h*4);for(let i=0,p=0;i<w*h;i++,p+=ch){const o=i*4;if(type===6){rgba[o]=scan[p];rgba[o+1]=scan[p+1];rgba[o+2]=scan[p+2];rgba[o+3]=scan[p+3];}else if(type===2){rgba[o]=scan[p];rgba[o+1]=scan[p+1];rgba[o+2]=scan[p+2];rgba[o+3]=255;}else if(type===4){rgba[o]=scan[p];rgba[o+1]=scan[p];rgba[o+2]=scan[p];rgba[o+3]=scan[p+1];}else{rgba[o]=scan[p];rgba[o+1]=scan[p];rgba[o+2]=scan[p];rgba[o+3]=255;}}
  return {width:w,height:h,data:rgba};
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function encodePng(w,h,pixels){const sig=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const d=y*(w*4+1);raw[d]=0;pixels.copy(raw,d+1,y*w*4,(y+1)*w*4);}return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function rgba(w,h,color=[24,29,37,255]){const out=Buffer.alloc(w*h*4);for(let i=0;i<w*h;i++){out[i*4]=color[0];out[i*4+1]=color[1];out[i*4+2]=color[2];out[i*4+3]=color[3];}return out;}
function rect(buf,w,h,x0,y0,x1,y1,c){x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(w-1,Math.ceil(x1));y1=Math.min(h-1,Math.ceil(y1));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const o=(y*w+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=c[3]??255;}}
function line(buf,w,h,x0,y0,x1,y1,c,th=2){const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1);for(let i=0;i<=n;i++){const x=x0+dx*i/n,y=y0+dy*i/n;rect(buf,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c);}}
function frameFromSheet(sheet,fw,fh,index){const out=Buffer.alloc(fw*fh*4);for(let y=0;y<fh;y++){const src=((y*sheet.width)+(index*fw))*4;sheet.data.copy(out,y*fw*4,src,src+fw*4);}return {width:fw,height:fh,data:out};}
function blit(dst,dw,dh,src,x,y,targetH,opts={}){const scale=targetH/src.height,targetW=Math.max(1,Math.round(src.width*scale)),outH=Math.max(1,Math.round(targetH));for(let oy=0;oy<outH;oy++)for(let ox=0;ox<targetW;ox++){const sx=Math.min(src.width-1,Math.floor(ox/scale)),sy=Math.min(src.height-1,Math.floor(oy/scale)),si=(sy*src.width+sx)*4,a=src.data[si+3];if(a<8)continue;let r=src.data[si],g=src.data[si+1],b=src.data[si+2];if(opts.silhouette){r=g=b=opts.silhouetteValue??30;}else if(opts.grayscale){const l=Math.round(r*.2126+g*.7152+b*.0722);r=g=b=l;}const dx=Math.round(x+ox),dy=Math.round(y+oy);if(dx<0||dy<0||dx>=dw||dy>=dh)continue;const di=(dy*dw+dx)*4,sa=a/255,da=dst[di+3]/255,oa=sa+da*(1-sa);if(oa<=0)continue;dst[di]=Math.round((r*sa+dst[di]*da*(1-sa))/oa);dst[di+1]=Math.round((g*sa+dst[di+1]*da*(1-sa))/oa);dst[di+2]=Math.round((b*sa+dst[di+2]*da*(1-sa))/oa);dst[di+3]=Math.round(oa*255);}}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function loadMotion(targetKey,target,motion){const m=target.motions[motion];if(!m)fail(`${targetKey} missing ${motion}`);const absolute=resolve(root,`apps/client/public${m.url}`);const sheet=decodePng(await readFile(absolute),`${targetKey}/${motion}`);return {sheet,meta:m};}
function chooseFrame(target,motion){const m=target.motions[motion];if(motion==='attack')return Math.min(target.attackContactFrame??0,m.frames-1);if(motion==='knockback')return Math.max(0,m.frames-1);if(motion==='death')return Math.max(0,Math.floor((m.frames-1)*.7));return 0;}

const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
await rm(outputRoot,{recursive:true,force:true});await mkdir(outputRoot,{recursive:true});
const cache=new Map();
for(const key of TARGET_ORDER){const target=metadata.targets[key];if(!target)fail(`metadata missing ${key}`);for(const motion of MOTIONS){const loaded=await loadMotion(key,target,motion);cache.set(`${key}:${motion}`,frameFromSheet(loaded.sheet,loaded.meta.frameWidth,loaded.meta.frameHeight,chooseFrame(target,motion)));}}

const boards=[];
async function save(name,w,h,pixels,intent){const bytes=encodePng(w,h,pixels),path=resolve(outputRoot,name);await writeFile(path,bytes);boards.push({id:name.replace(/\.png$/,''),file:relative(resolve(root,'assets/raw/production/review/vertical-slice-01'),path).replaceAll('\\','/'),width:w,height:h,bytes:bytes.length,sha256:sha256(bytes),intent});}

{
  const w=1280,h=720,b=rgba(w,h,[235,238,240,255]);
  TARGET_ORDER.forEach((key,i)=>{const x=44+i*247;rect(b,w,h,x,48,x+218,672,[218,223,227,255]);for(let m=0;m<MOTIONS.length;m++){const motion=MOTIONS[m],f=cache.get(`${key}:${motion}`);const y=72+m*116;blit(b,w,h,f,x+44,y,96,{grayscale:false});line(b,w,h,x+16,y+104,x+202,y+104,[174,180,184,255],1);}});
  await save('motion-key-poses.png',w,h,b,'Five committed runtime motions per target, fixed target order F1/F2/F3/raider/boss.');
}
{
  const w=1280,h=720,b=rgba(w,h,[244,244,242,255]);
  TARGET_ORDER.forEach((key,i)=>{const f=cache.get(`${key}:idle`),x=82+i*246;blit(b,w,h,f,x,218,260,{silhouette:true,silhouetteValue:28});line(b,w,h,x-22,500,x+210,500,[118,118,118,255],2);});
  await save('silhouette-comparison.png',w,h,b,'Color-free committed idle silhouettes in canonical comparison order. Human judgment still required.');
}
{
  const w=1280,h=720,b=rgba(w,h,[30,34,43,255]);
  TARGET_ORDER.forEach((key,i)=>{const target=metadata.targets[key],x=62+i*244;const before=cache.get(`${key}:idle`),contact=cache.get(`${key}:attack`),after=cache.get(`${key}:knockback`);rect(b,w,h,x,62,x+214,656,[42,48,60,255]);blit(b,w,h,before,x+49,88,150);blit(b,w,h,contact,x+34,280,180);blit(b,w,h,after,x+49,498,150);line(b,w,h,x+22,474,x+192,474,[224,183,91,255],3);line(b,w,h,x+107,260,x+107,485,[122,91,224,255],2);});
  await save('contact-board.png',w,h,b,'Idle/contact/knockback visual sequence using each target attackContactFrame. Simulation screenshot confirmation remains pending.');
}
{
  const w=1280,h=720,b=rgba(w,h,[224,229,232,255]);line(b,w,h,40,550,1240,550,[97,105,111,255],3);
  TARGET_ORDER.forEach((key,i)=>{const target=metadata.targets[key],f=cache.get(`${key}:idle`),display=target.displayHeight??176,x=80+i*242;blit(b,w,h,f,x,550-display,display,{grayscale:false});line(b,w,h,x-14,550,x+194,550,[72,80,86,255],2);});
  await save('scale-sheet.png',w,h,b,'Committed displayHeight comparison at one shared ground line.');
}
{
  const w=1280,h=720,b=rgba(w,h,[246,244,238,255]);
  TARGET_ORDER.forEach((key,i)=>{const target=metadata.targets[key],x=48+i*247,side=cache.get(`${key}:idle`),attack=cache.get(`${key}:attack`),death=cache.get(`${key}:death`);rect(b,w,h,x,54,x+218,666,[229,225,214,255]);blit(b,w,h,side,x+43,86,170,{grayscale:false});blit(b,w,h,side,x+43,284,170,{grayscale:true});blit(b,w,h,attack,x+43,474,130,{grayscale:false});blit(b,w,h,death,x+43,592,64,{grayscale:false});line(b,w,h,x+20,276,x+198,276,[166,157,137,255],1);});
  await save('reference-sheet.png',w,h,b,'Sufficient side-view reference sheet: committed idle color/grayscale plus attack/death identity anchors. Not a fabricated front/back turnaround.');
}
{
  const w=1280,h=720,b=rgba(w,h,[238,240,241,255]);
  TARGET_ORDER.forEach((key,i)=>{const x=48+i*247;rect(b,w,h,x,54,x+218,666,[220,225,228,255]);const own=cache.get(`${key}:idle`);blit(b,w,h,own,x+36,88,170,{silhouette:true,silhouetteValue:25});const neighbors=TARGET_ORDER.filter(k=>k!==key).slice(0,3);neighbors.forEach((n,j)=>{const f=cache.get(`${n}:idle`);blit(b,w,h,f,x+15+j*66,374,92,{silhouette:true,silhouetteValue:72+j*34});});line(b,w,h,x+18,348,x+200,348,[134,143,149,255],2);});
  await save('closest-three-differences.png',w,h,b,'Preflight nearest-neighbor silhouette comparison; semantic difference notes live in the review page/manifest, not encoded as fake image text.');
}

const manifest={
  schemaVersion:1,
  status:'PREFLIGHT_ONLY_NOT_REVIEW_EVIDENCE',
  generatedFrom:'apps/client/public/assets/production/units/first-slice-runtime-metadata.json',
  generatedFromReviewStatus:metadata.reviewStatus,
  targetOrder:TARGET_ORDER,
  boards,
  contractMapping:{
    'turnaround-reference':{candidate:'preflight/reference-sheet.png',qualification:'SUFFICIENT_SIDE_REFERENCE_CANDIDATE_NOT_FULL_TURNAROUND'},
    'silhouette-comparison':{candidate:'preflight/silhouette-comparison.png',qualification:'PREFLIGHT'},
    'motion-key-poses':{candidate:'preflight/motion-key-poses.png',qualification:'PREFLIGHT'},
    'contact-board':{candidate:'preflight/contact-board.png',qualification:'VISUAL_CONTACT_FRAME_PREFLIGHT_SIM_CAPTURE_PENDING'},
    'scale-sheet':{candidate:'preflight/scale-sheet.png',qualification:'PREFLIGHT'},
    'closest-three-differences':{candidate:'preflight/closest-three-differences.png',qualification:'PREFLIGHT_NOT_HUMAN_JUDGMENT'}
  },
  missingForReadyForReview:[
    'real runtime PNG captures at exact review viewport sizes',
    'human-authored closest-three difference notes/acceptance',
    'target provenance promoted into canonical review package',
    'human decision that side reference is sufficient or a true turnaround is required'
  ],
  humanReview:{status:'PENDING',reviewer:null,reviewedAt:null}
};
await writeFile(resolve(outputRoot,'preflight-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`first-slice review preflight OK: ${boards.length} PNG boards, ${TARGET_ORDER.length} unit targets`);
