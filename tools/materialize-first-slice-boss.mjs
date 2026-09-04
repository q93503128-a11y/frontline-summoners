import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = resolve(root, 'apps/client/public/assets/production/units');
const dir = resolve(outRoot, 'enemy-boss');
const META = resolve(outRoot, 'first-slice-runtime-metadata.json');
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters/Evil%20Wizard/Sprites';
const motions = {
  idle: [`${NQM}/Idle.png`, 8],
  move: [`${NQM}/Move.png`, 8],
  attack: [`${NQM}/Attack.png`, 8],
  knockback: [`${NQM}/Take%20Hit.png`, 4],
  death: [`${NQM}/Death.png`, 5],
};
const W = 150, H = 150, GENERATOR_VERSION = 4;

function fail(message) { throw new Error(`[first-slice boss] ${message}`); }
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decode(bytes,label){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)fail(`${label} not PNG`);
  let o=8,w=0,h=0,bd=0,ct=0,interlace=0;const id=[];
  while(o+12<=bytes.length){const n=bytes.readUInt32BE(o),t=bytes.toString('ascii',o+4,o+8),d=bytes.subarray(o+8,o+8+n);o+=12+n;if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];interlace=d[12];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;}
  if(bd!==8||ct!==6||interlace!==0)fail(`${label} unsupported PNG encoding`);
  const rb=w*4,raw=inflateSync(Buffer.concat(id)),scan=Buffer.alloc(rb*h);let s=0;
  for(let y=0;y<h;y++){const f=raw[s++],row=scan.subarray(y*rb,(y+1)*rb),prev=y?scan.subarray((y-1)*rb,y*rb):null;for(let x=0;x<rb;x++){const v=raw[s++],l=x>=4?row[x-4]:0,u=prev?prev[x]:0,ul=prev&&x>=4?prev[x-4]:0;row[x]=f===0?v:f===1?(v+l)&255:f===2?(v+u)&255:f===3?(v+Math.floor((l+u)/2))&255:f===4?(v+paeth(l,u,ul))&255:fail(`${label} invalid filter ${f}`);}}
  return { width:w, height:h, data:scan };
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d){const tb=Buffer.from(t),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(d.length);crc.writeUInt32BE(crc32(Buffer.concat([tb,d])));return Buffer.concat([len,tb,d,crc]);}
function encode(w,h,p){const sig=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const d=y*(w*4+1);raw[d]=0;p.copy(raw,d+1,y*w*4,(y+1)*w*4);}return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function blend(b,x,y,c,a=1){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4,sa=(c[3]??255)/255*a,da=b[i+3]/255,oa=sa+da*(1-sa);if(oa<=0)return;for(let k=0;k<3;k++)b[i+k]=Math.round((c[k]*sa+b[i+k]*da*(1-sa))/oa);b[i+3]=Math.round(oa*255);}
function ellipse(b,cx,cy,rx,ry,c,a=1){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)blend(b,x,y,c,a);}
function line(b,x0,y0,x1,y1,c,th=1,a=1){const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1);for(let i=0;i<=n;i++){const x=x0+dx*i/n,y=y0+dy*i/n;for(let yy=-th;yy<=th;yy++)for(let xx=-th;xx<=th;xx++)blend(b,x+xx,y+yy,c,a);}}
function tri(b,a,p,c,col,alpha=1){const minX=Math.floor(Math.min(a[0],p[0],c[0])),maxX=Math.ceil(Math.max(a[0],p[0],c[0])),minY=Math.floor(Math.min(a[1],p[1],c[1])),maxY=Math.ceil(Math.max(a[1],p[1],c[1]));const area=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const q=[x,y],s1=area(a,p,q),s2=area(p,c,q),s3=area(c,a,q);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))blend(b,x,y,col,alpha);}}
function sourceFrame(sheet,index){const frame=Buffer.alloc(W*H*4);for(let y=0;y<H;y++){const s=((y*sheet.width)+index*W)*4;sheet.data.copy(frame,y*W*4,s,s+W*4);}return frame;}
function recolor([r,g,b,a]){const lum=(r+g+b)/765;return[Math.min(255,Math.round(r*.66+37+lum*20)),Math.min(255,Math.round(g*.57+19+lum*11)),Math.min(255,Math.round(b*.78+55+lum*28)),a];}

function drawMask(out,maskX,maskY,attackStrength,deathStrength){
  const gold=[218,171,72,255],goldHi=[255,220,122,255],dark=[84,50,39,255],voidCol=[39,27,42,255];
  const rx=34,ry=27;ellipse(out,maskX,maskY,rx,ry,gold,.98);ellipse(out,maskX,maskY+3,26,19,dark,1);ellipse(out,maskX,maskY+5,20,14,voidCol,.92);
  ellipse(out,maskX-10,maskY-2,5,7,goldHi,1);ellipse(out,maskX+10,maskY-2,5,7,goldHi,1);
  tri(out,[maskX-rx+5,maskY-15],[maskX-rx-13-attackStrength*7,maskY-31],[maskX-15,maskY-22],gold,1);
  tri(out,[maskX+rx-5,maskY-15],[maskX+rx+13+attackStrength*7,maskY-31],[maskX+15,maskY-22],gold,1);
  line(out,maskX-15,maskY+13,maskX,maskY+22,dark,1);line(out,maskX,maskY+22,maskX+15,maskY+13,dark,1);
  line(out,maskX-8,maskY+18,maskX-4,maskY+25,goldHi,1,.75);line(out,maskX+8,maskY+18,maskX+4,maskY+25,goldHi,1,.75);
  if(attackStrength>0){const radius=42+Math.round(attackStrength*23);ellipse(out,maskX,maskY,radius,radius*.73,goldHi,.06+.16*attackStrength);for(let a=0;a<12;a++){const ang=a*Math.PI/6;line(out,maskX+Math.cos(ang)*(radius-8),maskY+Math.sin(ang)*(radius*.73-6),maskX+Math.cos(ang)*(radius+6),maskY+Math.sin(ang)*(radius*.73+5),goldHi,1,.48+.38*attackStrength);}}
  if(deathStrength>.12){line(out,maskX-25,maskY-19,maskX-7,maskY-3,voidCol,2,.82);line(out,maskX+19,maskY-14,maskX+4,maskY+2,voidCol,2,.78);}
  if(deathStrength>.45){line(out,maskX-5,maskY-24,maskX+2,maskY-5,voidCol,2,.82);}
}

function render(frame,motion,index,count){
  const out=Buffer.alloc(W*H*4),p=index/Math.max(1,count-1),sway=Math.sin(index*Math.PI/2);
  const attackSteps=[0,.12,.26,.43,.68,1,.58,.18];
  const deathDrops=[0,12,30,48,60],deathBodyY=[4,4,5,11,20],deathWobble=[0,-2,3,-4,2];
  const knockBody=[0,-5,-10,-14],knockMask=[0,0,-2,-7];
  const attack=motion==='attack'?(attackSteps[index]??0):0;
  const death=motion==='death'?p:0;
  const bodyDx=motion==='move'?Math.round(sway*2):motion==='knockback'?(knockBody[index]??-14):0;
  const bodyDy=motion==='death'?(deathBodyY[index]??20):4;
  const maskDx=motion==='move'?Math.round(sway*3):motion==='knockback'?(knockMask[index]??-7):motion==='death'?(deathWobble[index]??0):0;
  const maskDrop=motion==='death'?(deathDrops[index]??60):0;
  const maskX=72+maskDx;
  const maskY=40+Math.round(Math.cos(index*.9)*2)+(motion==='attack'?-Math.round(attack*6):0)+maskDrop;

  drawMask(out,maskX,maskY,attack,death);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,a=frame[i+3];if(a<8)continue;blend(out,x+bodyDx,y+bodyDy,recolor([frame[i],frame[i+1],frame[i+2],a]),1);}

  const tether=[215,170,72,255];
  line(out,maskX-23,maskY+23,69+bodyDx,79+bodyDy,tether,1,motion==='death'?.20:.34);
  line(out,maskX+23,maskY+23,86+bodyDx,77+bodyDy,tether,1,motion==='death'?.20:.34);
  if(motion==='knockback'&&index>0){
    const separation=Math.abs(bodyDx-maskDx);
    line(out,maskX+28,maskY-8,maskX+34+separation,maskY-9,tether,1,.45);
    if(index>=2)ellipse(out,maskX+4,maskY+1,39+separation,31,[255,220,122,255],.05);
  }
  if(motion==='death'&&index>=1){
    line(out,maskX-18,maskY+27,maskX-25,maskY+38,[255,220,122,255],1,.35);
    line(out,maskX+16,maskY+25,maskX+22,maskY+40,[255,220,122,255],1,.31);
  }
  return out;
}

const delay=(ms)=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms));
async function fetchBytes(url){let last;for(let attempt=1;attempt<=3;attempt++){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{headers:{'user-agent':'frontline-summoners-build/4.0'},signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}catch(error){last=error;if(attempt<3)await delay(400*attempt);}finally{clearTimeout(timeout);}}throw new Error(`download failed ${url}: ${String(last)}`);}

await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
const meta=JSON.parse(await readFile(META,'utf8'));
meta.targets['enemy-boss']={
  assetId:'unit:enemy-boss',sourceFamily:'evil-wizard',displayHeight:228,attackContactFrame:5,structuralRework:true,
  visualPolish:{version:GENERATOR_VERSION,kind:'GOLDEN_MASK_MOTION_LANGUAGE_PASS',reviewStatus:'UNREVIEWED_RUNTIME_FILES',emphasis:['LONG_MASK_ANTICIPATION','BODY_LEADS_KNOCKBACK','MASK_DELAYED_FOLLOW','MASK_FAILS_BEFORE_BODY_COLLAPSE']},
  motions:{},
};
const deathSourceMap=[0,0,1,3,4];
for(const [motion,[url,frames]] of Object.entries(motions)){
  const src=decode(await fetchBytes(url),motion);if(src.width!==W*frames||src.height!==H)fail(`${motion} source dimensions changed`);
  const strip=Buffer.alloc(src.width*src.height*4);
  for(let i=0;i<frames;i++){
    const sourceIndex=motion==='death'?(deathSourceMap[i]??i):i;
    const frame=render(sourceFrame(src,sourceIndex),motion,i,frames);
    for(let y=0;y<H;y++){const d=((y*src.width)+i*W)*4;frame.copy(strip,d,y*W*4,(y+1)*W*4);}
  }
  const bytes=encode(src.width,src.height,strip),file=`${motion}.png`;await writeFile(resolve(dir,file),bytes);
  meta.targets['enemy-boss'].motions[motion]={url:`/assets/production/units/enemy-boss/${file}`,frameWidth:W,frameHeight:H,frames,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sourceUrl:url};
}
meta.bossGenerator={generator:'tools/materialize-first-slice-boss.mjs',generatorVersion:GENERATOR_VERSION,reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
await writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log('[production art] enemy-boss golden-mask v4 materialized with body-leading knockback, delayed mask follow, and mask-first collapse; lifecycle remains AWAITING_ART');
