import { mkdir, rm, writeFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/production/units');
const generatorVersion = 2;

const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';
const CLICKER_MW3 = 'https://raw.githubusercontent.com/chaurunda/ClickerGodot/c425114bfa522b1e57f0cfc4f486580a3210f36d/assets/Medieval%20Warrior%20Pack%203/Sprites';

const targets = {
  'militia/militia_f1': {
    assetId: 'unit:militia:militia_f1', sourceFamily: 'warrior-3', displayHeight: 174, attackContactFrame: 2,
    palette: [111, 91, 69], gear: [72, 61, 48], accent: [168, 146, 109], pack: [18, 24], weapon: 27, form: 1,
    source: {
      idle: [`${CLICKER_MW3}/Idle.png`, 135, 135, 10],
      move: [`${CLICKER_MW3}/Run.png`, 135, 135, 6],
      attack: [`${CLICKER_MW3}/Attack1.png`, 135, 135, 4],
      knockback: [`${CLICKER_MW3}/Get%20Hit.png`, 135, 135, 3],
      death: [`${CLICKER_MW3}/Death.png`, 135, 135, 9],
    },
  },
  'militia/militia_f2': {
    assetId: 'unit:militia:militia_f2', sourceFamily: 'hero-knight-2', displayHeight: 184, attackContactFrame: 3,
    palette: [93, 91, 83], gear: [56, 61, 62], accent: [190, 192, 185], pack: [22, 26], weapon: 35, form: 2,
    source: {
      idle: [`${NQM}/Hero%20Knight%202/Sprites/Idle.png`, 140, 140, 11],
      move: [`${NQM}/Hero%20Knight%202/Sprites/Run.png`, 140, 140, 8],
      attack: [`${NQM}/Hero%20Knight%202/Sprites/Attack.png`, 140, 140, 6],
      knockback: [`${NQM}/Hero%20Knight%202/Sprites/Take%20Hit.png`, 140, 140, 4],
      death: [`${NQM}/Hero%20Knight%202/Sprites/Death.png`, 140, 140, 9],
    },
  },
  'militia/militia_f3': {
    assetId: 'unit:militia:militia_f3', sourceFamily: 'warrior-1', displayHeight: 176, attackContactFrame: 2,
    palette: [82, 72, 62], gear: [49, 49, 50], accent: [145, 137, 126], pack: [17, 22], weapon: 22, form: 3,
    source: {
      idle: [`${NQM}/Medieval%20Warrior%20Pack/Idle.png`, 184, 137, 6],
      move: [`${NQM}/Medieval%20Warrior%20Pack/Run.png`, 184, 137, 8],
      attack: [`${NQM}/Medieval%20Warrior%20Pack/Attack1.png`, 184, 137, 4],
      knockback: [`${NQM}/Medieval%20Warrior%20Pack/Hit.png`, 184, 137, 3],
      death: [`${NQM}/Medieval%20Warrior%20Pack/Death.png`, 184, 137, 9],
    },
  },
  'enemy-raider': {
    assetId: 'unit:enemy-raider', sourceFamily: 'warrior', displayHeight: 178, attackContactFrame: 2,
    palette: [103, 75, 54], gear: [57, 45, 36], accent: [151, 98, 58], pack: [38, 35], weapon: 17, raider: true,
    source: {
      idle: [`${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Idle.png`, 150, 150, 8],
      move: [`${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Run.png`, 150, 150, 8],
      attack: [`${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Attack1.png`, 150, 150, 4],
      knockback: [`${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Take%20Hit.png`, 150, 150, 4],
      death: [`${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Death.png`, 150, 150, 6],
    },
  },
};

function fail(message) { throw new Error(`[first-slice materialize] ${message}`); }
function paeth(a, b, c) { const p = a + b - c; const pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
function decodePng(bytes, label) {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) fail(`${label} is not PNG`);
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); const type = bytes.toString('ascii', offset + 4, offset + 8); const data = bytes.subarray(offset + 8, offset + 8 + length); offset += 12 + length;
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || interlace !== 0) fail(`${label} unsupported PNG encoding bitDepth=${bitDepth} interlace=${interlace}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0;
  if (!channels) fail(`${label} unsupported PNG colorType=${colorType}`);
  const rowBytes = width * channels; const raw = inflateSync(Buffer.concat(idat)); const scan = Buffer.alloc(rowBytes * height);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src++]; const row = scan.subarray(y * rowBytes, (y + 1) * rowBytes); const prev = y === 0 ? null : scan.subarray((y - 1) * rowBytes, y * rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[src++]; const left = x >= channels ? row[x - channels] : 0; const up = prev ? prev[x] : 0; const upLeft = prev && x >= channels ? prev[x - channels] : 0;
      row[x] = filter === 0 ? value : filter === 1 ? (value + left) & 255 : filter === 2 ? (value + up) & 255 : filter === 3 ? (value + Math.floor((left + up) / 2)) & 255 : filter === 4 ? (value + paeth(left, up, upLeft)) & 255 : fail(`${label} invalid filter ${filter}`);
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i += 1, p += channels) {
    const o = i * 4;
    if (colorType === 6) { rgba[o]=scan[p]; rgba[o+1]=scan[p+1]; rgba[o+2]=scan[p+2]; rgba[o+3]=scan[p+3]; }
    else if (colorType === 2) { rgba[o]=scan[p]; rgba[o+1]=scan[p+1]; rgba[o+2]=scan[p+2]; rgba[o+3]=255; }
    else if (colorType === 4) { rgba[o]=scan[p]; rgba[o+1]=scan[p]; rgba[o+2]=scan[p]; rgba[o+3]=scan[p+1]; }
    else { rgba[o]=scan[p]; rgba[o+1]=scan[p]; rgba[o+2]=scan[p]; rgba[o+3]=255; }
  }
  return { width, height, data: rgba };
}

const crcTable = new Uint32Array(256);
for (let n=0;n<256;n+=1){ let c=n; for(let k=0;k<8;k+=1)c=(c&1)?0xedb88320^(c>>>1):c>>>1; crcTable[n]=c>>>0; }
function crc32(buf){ let c=0xffffffff; for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function chunk(type,data){ const t=Buffer.from(type); const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([len,t,data,crc]); }
function encodePng(width,height,pixels){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]); const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6;
  const raw=Buffer.alloc((width*4+1)*height); for(let y=0;y<height;y+=1){ const dst=y*(width*4+1); raw[dst]=0; pixels.copy(raw,dst+1,y*width*4,(y+1)*width*4); }
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

function blendPixel(buf,w,h,x,y,color,alpha=1){ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=w||y>=h)return; const i=(y*w+x)*4; const sa=(color[3]??255)/255*alpha, da=buf[i+3]/255, oa=sa+da*(1-sa); if(oa<=0)return; for(let k=0;k<3;k+=1)buf[i+k]=Math.round((color[k]*sa+buf[i+k]*da*(1-sa))/oa); buf[i+3]=Math.round(oa*255); }
function rect(buf,w,h,x0,y0,x1,y1,c,a=1){ for(let y=Math.round(y0);y<=Math.round(y1);y+=1)for(let x=Math.round(x0);x<=Math.round(x1);x+=1)blendPixel(buf,w,h,x,y,c,a); }
function line(buf,w,h,x0,y0,x1,y1,c,th=1,a=1){ const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1); for(let i=0;i<=n;i+=1){const x=x0+dx*i/n,y=y0+dy*i/n;rect(buf,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c,a);} }
function ellipse(buf,w,h,cx,cy,rx,ry,c,a=1){ for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y+=1)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x+=1)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)blendPixel(buf,w,h,x,y,c,a); }
function triangle(buf,w,h,a,b,c,col,alpha=1){ const minX=Math.floor(Math.min(a[0],b[0],c[0])),maxX=Math.ceil(Math.max(a[0],b[0],c[0])),minY=Math.floor(Math.min(a[1],b[1],c[1])),maxY=Math.ceil(Math.max(a[1],b[1],c[1])); const area=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]); for(let y=minY;y<=maxY;y+=1)for(let x=minX;x<=maxX;x+=1){const p=[x,y],s1=area(a,b,p),s2=area(b,c,p),s3=area(c,a,p);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))blendPixel(buf,w,h,x,y,col,alpha);} }
function bbox(frame,w,h){ let minX=w,minY=h,maxX=-1,maxY=-1; for(let y=0;y<h;y+=1)for(let x=0;x<w;x+=1){if(frame[(y*w+x)*4+3]>20){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}} return maxX<0?{minX:0,minY:0,maxX:w-1,maxY:h-1,width:w,height:h}:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1}; }
function copyFrame(sheet,fw,fh,index){ const frame=Buffer.alloc(fw*fh*4); for(let y=0;y<fh;y+=1){const src=((y*sheet.width)+(index*fw))*4; sheet.data.copy(frame,y*fw*4,src,src+fw*4);} return frame; }
function grade([r,g,b,a], palette){ const lum=(r*0.2126+g*0.7152+b*0.0722)/255; const mix=0.18; return [Math.round(r*(1-mix)+palette[0]*mix*(0.65+0.35*lum)),Math.round(g*(1-mix)+palette[1]*mix*(0.65+0.35*lum)),Math.round(b*(1-mix)+palette[2]*mix*(0.65+0.35*lum)),a]; }
function compositeTransformed(out,src,w,h,spec,motion,index,count,box){
  const phase=index/Math.max(1,count-1); const forward=spec.form===3?4:spec.raider?3:0; const drop=spec.form===3?(motion==='move'?3:2):0; const knock=motion==='knockback'?-Math.round(phase*3):0;
  for(let y=0;y<h;y+=1)for(let x=0;x<w;x+=1){const i=(y*w+x)*4,a=src[i+3];if(a<8)continue; const relY=(y-box.minY)/Math.max(1,box.height-1); const lean=Math.round((1-relY)*forward); const tx=x+lean+knock,ty=y+drop; const c=grade([src[i],src[i+1],src[i+2],a],spec.palette); blendPixel(out,w,h,tx,ty,c,1); }
}
function drawRework(frame,w,h,spec,motion,index,count){
  const out=Buffer.alloc(w*h*4); const box=bbox(frame,w,h); const phase=index/Math.max(1,count-1); const wave=Math.sin(index*Math.PI/2); const bodyCx=(box.minX+box.maxX)/2, bodyCy=box.minY+box.height*0.56;
  const packLagY=motion==='move'?Math.round(wave*3):motion==='death'?Math.round(phase*(spec.raider?18:9)):motion==='knockback'?(spec.raider?2:4):0;
  const packLagX=motion==='knockback'?(spec.raider?7:3):motion==='death'?(spec.raider?-Math.round(phase*4):0):0;
  const [pw,ph]=spec.pack; const packX=bodyCx-box.width*(spec.raider?0.30:0.22)+packLagX; const packY=bodyCy-box.height*0.03+packLagY;
  const body=[...spec.palette,255], gear=[...spec.gear,255], accent=[...spec.accent,255];
  if(spec.raider){
    ellipse(out,w,h,packX,packY,pw/2,ph/2,body,1); ellipse(out,w,h,packX-pw*0.28,packY-ph*0.22,pw*0.30,ph*0.36,gear,1);
    rect(out,w,h,packX-pw*0.55,packY-ph*0.72,packX-pw*0.42,packY-ph*0.28,accent,1);
    triangle(out,w,h,[packX-pw*0.28,packY-ph*0.55],[packX-pw*0.05,packY-ph*0.82],[packX+pw*0.05,packY-ph*0.42],accent,1);
  } else {
    const irregular=spec.form===1?2:0; rect(out,w,h,packX-pw/2-irregular,packY-ph/2,packX+pw/2,packY+ph/2,body,1);
    line(out,w,h,packX-pw*0.28,packY-ph/2,packX+pw*0.28,packY+ph/2,accent,spec.form===2?2:1,0.9);
    if(spec.form===1){rect(out,w,h,packX-pw/2-3,packY-ph*0.18,packX-pw/2+2,packY+ph*0.26,gear,1);}
  }
  compositeTransformed(out,frame,w,h,spec,motion,index,count,box);
  if(spec.raider){
    line(out,w,h,bodyCx-box.width*0.16,box.minY+box.height*0.23,bodyCx+box.width*0.05,box.minY+box.height*0.72,accent,2,0.9);
    const push=motion==='attack'?Math.round(Math.sin(phase*Math.PI)*6):0; const y=box.minY+box.height*0.58; const x1=bodyCx+box.width*0.08+push; line(out,w,h,x1,y,x1+spec.weapon,y+2,gear,3,1); rect(out,w,h,x1+spec.weapon-2,y-3,x1+spec.weapon+3,y+5,gear,1);
  } else {
    if(spec.form===2){ rect(out,w,h,bodyCx-box.width*0.12,box.minY+box.height*0.28,bodyCx+box.width*0.02,box.minY+box.height*0.34,gear,0.95); line(out,w,h,bodyCx-box.width*0.12,box.minY+box.height*0.62,bodyCx+box.width*0.12,box.minY+box.height*0.62,accent,2,0.9); }
    if(spec.form===3){ for(let j=0;j<3;j+=1)line(out,w,h,packX-pw*0.30,packY-ph*0.25+j*5,packX+pw*0.12,packY-ph*0.33+j*5,accent,1,0.95); line(out,w,h,bodyCx-box.width*0.08,box.minY+box.height*0.46,bodyCx+box.width*0.04,box.minY+box.height*0.40,accent,1,0.9); }
    const push=motion==='attack'?Math.round(Math.sin(phase*Math.PI)*(spec.form===3?6:9)):0; const y=box.minY+box.height*(spec.form===3?0.60:0.55); const x1=bodyCx+box.width*0.10+push; const x2=x1+spec.weapon; line(out,w,h,x1,y,x2,y-(spec.form===1?2:4),accent,spec.form===3?3:2,1); triangle(out,w,h,[x2+5,y-4],[x2-1,y-8],[x2-1,y+1],accent,1);
  }
  return out;
}

const delay=(ms)=>new Promise(r=>setTimeout(r,ms));
async function fetchBytes(url){ let last; for(let attempt=1;attempt<=3;attempt+=1){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{headers:{'user-agent':'frontline-summoners-build/2.0'},redirect:'follow',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}catch(error){last=error;if(attempt<3)await delay(400*attempt);}finally{clearTimeout(timeout);}} throw new Error(`download failed ${url}: ${String(last)}`);}

await mkdir(outputRoot,{recursive:true});
const metadata={schemaVersion:2,generator:'tools/materialize-first-slice-production-art.mjs',generatorVersion,reviewStatus:'UNREVIEWED_RUNTIME_FILES',structuralRework:true,targets:{}};
for(const [target,spec] of Object.entries(targets)){
  const dir=resolve(outputRoot,target); await rm(dir,{recursive:true,force:true}); await mkdir(dir,{recursive:true});
  metadata.targets[target]={assetId:spec.assetId,sourceFamily:spec.sourceFamily,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,structuralRework:true,motions:{}};
  for(const [motion,[url,fw,fh,frames]] of Object.entries(spec.source)){
    const sourceBytes=await fetchBytes(url); const source=decodePng(sourceBytes,`${target}/${motion}`);
    if(source.width!==fw*frames||source.height!==fh) fail(`${target}/${motion} source dimensions changed: expected ${fw*frames}x${fh}, got ${source.width}x${source.height}`);
    const strip=Buffer.alloc(source.width*source.height*4);
    for(let i=0;i<frames;i+=1){const srcFrame=copyFrame(source,fw,fh,i);const outFrame=drawRework(srcFrame,fw,fh,spec,motion,i,frames);for(let y=0;y<fh;y+=1){const dst=((y*source.width)+(i*fw))*4;outFrame.copy(strip,dst,y*fw*4,(y+1)*fw*4);}}
    const bytes=encodePng(source.width,source.height,strip); const filename=`${motion}.png`; await writeFile(resolve(dir,filename),bytes);
    metadata.targets[target].motions[motion]={url:`/assets/production/units/${target}/${filename}`,frameWidth:fw,frameHeight:fh,frames,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sourceUrl:url};
  }
}
await writeFile(resolve(outputRoot,'first-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[production art] reworked ${Object.keys(targets).length} CC0 source families × 5 motions; runtime files are unreviewed and lifecycle stays AWAITING_ART`);
