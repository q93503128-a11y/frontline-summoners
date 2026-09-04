import { mkdir, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/production/units');
const W = 96;
const H = 96;
const MOTIONS = { idle: 6, move: 8, attack: 6, knockback: 4, death: 7 };

const specs = {
  'militia/militia_f1': { body:[112,91,69,255], gear:[70,60,48,255], metal:[165,145,110,255], pack:[18,24], weapon:28, stance:0, form:1 },
  'militia/militia_f2': { body:[92,91,84,255], gear:[55,60,61,255], metal:[190,192,185,255], pack:[22,26], weapon:36, stance:1, form:2 },
  'militia/militia_f3': { body:[82,72,62,255], gear:[48,49,50,255], metal:[145,137,126,255], pack:[17,22], weapon:23, stance:6, form:3 },
  'enemy-raider': { body:[103,75,54,255], gear:[58,45,36,255], metal:[145,91,55,255], pack:[35,33], weapon:18, stance:3, raider:true },
};

const crcTable = new Uint32Array(256);
for (let n=0;n<256;n+=1){ let c=n; for(let k=0;k<8;k+=1)c=(c&1)?0xedb88320^(c>>>1):c>>>1; crcTable[n]=c>>>0; }
function crc32(buf){ let c=0xffffffff; for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function chunk(type,data){ const t=Buffer.from(type); const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([len,t,data,crc]); }
function png(width,height,pixels){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]); const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6;
  const raw=Buffer.alloc((width*4+1)*height); for(let y=0;y<height;y+=1){ const dst=y*(width*4+1); raw[dst]=0; pixels.copy(raw,dst+1,y*width*4,(y+1)*width*4); }
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function canvas(width,height){ return Buffer.alloc(width*height*4); }
function px(buf,width,height,x,y,c){ x=Math.round(x);y=Math.round(y); if(x<0||y<0||x>=width||y>=height)return; const i=(y*width+x)*4; for(let k=0;k<4;k+=1)buf[i+k]=c[k]; }
function rect(buf,w,h,x0,y0,x1,y1,c){ for(let y=Math.round(y0);y<=Math.round(y1);y+=1)for(let x=Math.round(x0);x<=Math.round(x1);x+=1)px(buf,w,h,x,y,c); }
function line(buf,w,h,x0,y0,x1,y1,c,th=1){ const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1); for(let i=0;i<=n;i+=1){ const x=x0+dx*i/n,y=y0+dy*i/n; rect(buf,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c); } }
function ellipse(buf,w,h,cx,cy,rx,ry,c){ for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y+=1)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x+=1)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)px(buf,w,h,x,y,c); }
function tri(buf,w,h,a,b,c0,col){ const minX=Math.floor(Math.min(a[0],b[0],c0[0])),maxX=Math.ceil(Math.max(a[0],b[0],c0[0])),minY=Math.floor(Math.min(a[1],b[1],c0[1])),maxY=Math.ceil(Math.max(a[1],b[1],c0[1])); const area=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]); for(let y=minY;y<=maxY;y+=1)for(let x=minX;x<=maxX;x+=1){const p=[x,y],s1=area(a,b,p),s2=area(b,c0,p),s3=area(c0,a,p);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))px(buf,w,h,x,y,col);} }

function drawFrame(buf,s,motion,i,n,frameX){
  const p=i/Math.max(1,n-1), bob=(motion==='idle'||motion==='move')?Math.round(Math.sin(i*Math.PI/2)*2):0;
  const lean=motion==='knockback'?-Math.round(p*7):motion==='attack'?Math.round(Math.sin(p*Math.PI)*7):motion==='death'?-Math.round(p*12):0;
  const ground=78,cx=frameX+48+lean,cy=51+s.stance+bob+(motion==='death'?Math.round(p*15):0),step=motion==='move'?Math.round(Math.sin(i*Math.PI/2)*5):0;
  line(buf,W*n,H,cx-5,cy+13,cx-8-step,ground,s.gear,5); line(buf,W*n,H,cx+4,cy+13,cx+7+step,ground,s.gear,5);
  rect(buf,W*n,H,cx-9,cy-11,cx+9,cy+14,s.body); ellipse(buf,W*n,H,cx,cy-18,7,7,[184,145,112,255]);
  if(!s.raider){
    const [pw,ph]=s.pack,px=cx-15; let py=cy-4; if(motion==='move')py+=Math.round(Math.sin(i*1.7)*3); if(motion==='knockback')py+=5; if(motion==='death')py+=Math.round(p*8);
    rect(buf,W*n,H,px-pw/2,py-ph/2,px+pw/2,py+ph/2,s.body); line(buf,W*n,H,px-pw/3,py-ph/2,px+pw/3,py+ph/2,s.metal,2);
    if(s.form===1){tri(buf,W*n,H,[cx-15,cy-8],[cx-7,cy-18],[cx-5,cy+2],s.gear);} else if(s.form===2){rect(buf,W*n,H,cx-11,cy-14,cx-2,cy-9,s.gear);rect(buf,W*n,H,cx-8,cy+5,cx+8,cy+9,s.gear);} else {tri(buf,W*n,H,[cx-12,cy+4],[cx-3,cy-2],[cx,cy+8],s.gear);for(let j=0;j<3;j+=1)line(buf,W*n,H,px-5,py-7+j*6,px+2,py-9+j*6,s.metal,1);}
    const push=motion==='attack'?Math.round(Math.sin(p*Math.PI)*10):0,y=cy-1,x1=cx+7+push,x2=x1+s.weapon; line(buf,W*n,H,x1,y,x2,y-4,s.metal,s.form===3?4:3); tri(buf,W*n,H,[x2+6,y-4],[x2-1,y-9],[x2-1,y+1],s.metal);
  } else {
    const [pw,ph]=s.pack; let sx=cx-22,sy=cy-5; if(motion==='move')sy+=Math.round(Math.sin(i*1.5)*4); if(motion==='knockback')sx+=7; if(motion==='death')sy+=Math.round(p*24);
    ellipse(buf,W*n,H,sx,sy,pw/2,ph/2,s.body); ellipse(buf,W*n,H,sx-11,sy-10,9,12,s.body); rect(buf,W*n,H,sx-20,sy-25,sx-14,sy-12,s.metal); tri(buf,W*n,H,[sx-10,sy-22],[sx-1,sy-31],[sx+2,sy-15],s.metal);
    const push=motion==='attack'?Math.round(Math.sin(p*Math.PI)*7):0; line(buf,W*n,H,cx+8+push,cy+2,cx+8+s.weapon+push,cy+4,s.gear,4); rect(buf,W*n,H,cx+24+push,cy-1,cx+30+push,cy+8,s.gear);
  }
}

await rm(outputRoot,{recursive:true,force:true});
const metadata={schemaVersion:1,generator:'tools/materialize-first-slice-production-art.mjs',reviewStatus:'UNREVIEWED_RUNTIME_FILES',targets:{}};
for(const [target,s] of Object.entries(specs)){
  const dir=resolve(outputRoot,target); await mkdir(dir,{recursive:true}); metadata.targets[target]={};
  for(const [motion,frames] of Object.entries(MOTIONS)){
    const pixels=canvas(W*frames,H); for(let i=0;i<frames;i+=1)drawFrame(pixels,s,motion,i,frames,i*W); const bytes=png(W*frames,H,pixels); await writeFile(resolve(dir,`${motion}.png`),bytes);
    metadata.targets[target][motion]={url:`/assets/production/units/${target}/${motion}.png`,frameWidth:W,frameHeight:H,frames,bytes:bytes.length};
  }
}
await writeFile(resolve(outputRoot,'first-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[production art] materialized ${Object.keys(specs).length} targets × ${Object.keys(MOTIONS).length} motions; status remains AWAITING_ART pending capture/review`);
