import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';
import { resolve } from 'node:path';

const ROOT = resolve('apps/client/public/assets/production/units');
const META = resolve(ROOT, 'first-slice-runtime-metadata.json');
const VERSION = 1;

const TARGETS = {
  'militia/militia_f2': {
    motions: ['attack'],
    emphasis: ['DISCIPLINED_SPEAR_SET', 'FULL_CONTACT_EXTENSION', 'ORDERLY_RECOVERY'],
  },
  'militia/militia_f3': {
    motions: ['move', 'attack'],
    emphasis: ['LOW_CENTER_RUN', 'COMPACT_PRELOAD', 'SHORT_COMMITTED_THRUST'],
  },
  'enemy-raider': {
    motions: ['knockback', 'death'],
    emphasis: ['SACK_INERTIA_SEPARATION', 'LOAD_LEADS_KNOCKBACK', 'SACK_FALLS_BEFORE_BODY'],
  },
};

function fail(message) { throw new Error(`[first-slice motion language] ${message}`); }
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decode(bytes,label){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)fail(`${label} not PNG`);
  let o=8,w=0,h=0,bd=0,ct=0,interlace=0;const id=[];
  while(o+12<=bytes.length){const n=bytes.readUInt32BE(o),t=bytes.toString('ascii',o+4,o+8),d=bytes.subarray(o+8,o+8+n);o+=12+n;if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];interlace=d[12];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;}
  if(bd!==8||ct!==6||interlace!==0)fail(`${label} unsupported PNG encoding`);
  const rb=w*4,raw=inflateSync(Buffer.concat(id)),scan=Buffer.alloc(rb*h);let s=0;
  for(let y=0;y<h;y++){const f=raw[s++],row=scan.subarray(y*rb,(y+1)*rb),prev=y?scan.subarray((y-1)*rb,y*rb):null;for(let x=0;x<rb;x++){const v=raw[s++],l=x>=4?row[x-4]:0,u=prev?prev[x]:0,ul=prev&&x>=4?prev[x-4]:0;row[x]=f===0?v:f===1?(v+l)&255:f===2?(v+u)&255:f===3?(v+Math.floor((l+u)/2))&255:f===4?(v+paeth(l,u,ul))&255:fail(`${label} invalid filter ${f}`);}}
  return {width:w,height:h,data:scan};
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d){const tb=Buffer.from(t),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(d.length);crc.writeUInt32BE(crc32(Buffer.concat([tb,d])));return Buffer.concat([len,tb,d,crc]);}
function encode(w,h,p){const sig=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const d=y*(w*4+1);raw[d]=0;p.copy(raw,d+1,y*w*4,(y+1)*w*4);}return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function blend(b,w,h,x,y,c,a=1){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4,sa=(c[3]??255)/255*a,da=b[i+3]/255,oa=sa+da*(1-sa);if(oa<=0)return;for(let k=0;k<3;k++)b[i+k]=Math.round((c[k]*sa+b[i+k]*da*(1-sa))/oa);b[i+3]=Math.round(oa*255);}
function rect(b,w,h,x0,y0,x1,y1,c,a=1){for(let y=Math.round(y0);y<=Math.round(y1);y++)for(let x=Math.round(x0);x<=Math.round(x1);x++)blend(b,w,h,x,y,c,a);}
function line(b,w,h,x0,y0,x1,y1,c,th=1,a=1){const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1);for(let i=0;i<=n;i++){const x=x0+dx*i/n,y=y0+dy*i/n;rect(b,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c,a);}}
function ellipse(b,w,h,cx,cy,rx,ry,c,a=1){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)blend(b,w,h,x,y,c,a);}
function tri(b,w,h,a,p,c,col,alpha=1){const minX=Math.floor(Math.min(a[0],p[0],c[0])),maxX=Math.ceil(Math.max(a[0],p[0],c[0])),minY=Math.floor(Math.min(a[1],p[1],c[1])),maxY=Math.ceil(Math.max(a[1],p[1],c[1]));const area=(u,v,z)=>(v[0]-u[0])*(z[1]-u[1])-(v[1]-u[1])*(z[0]-u[0]);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const q=[x,y],s1=area(a,p,q),s2=area(p,c,q),s3=area(c,a,q);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))blend(b,w,h,x,y,col,alpha);}}
function bbox(frame,w,h){let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(frame[(y*w+x)*4+3]>20){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return maxX<0?{minX:0,minY:0,maxX:w-1,maxY:h-1,width:w,height:h}:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};}
function frameFromSheet(sheet,fw,fh,index){const f=Buffer.alloc(fw*fh*4);for(let y=0;y<fh;y++){const s=((y*sheet.width)+index*fw)*4;sheet.data.copy(f,y*fw*4,s,s+fw*4);}return f;}
function putFrame(sheet,frame,fw,fh,index){for(let y=0;y<fh;y++){const d=((y*sheet.width)+index*fw)*4;frame.copy(sheet.data,d,y*fw*4,(y+1)*fw*4);}}
function translate(frame,w,h,dx,dy){if(dx===0&&dy===0)return;const src=Buffer.from(frame);frame.fill(0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=(y*w+x)*4;if(src[si+3]===0)continue;const tx=x+dx,ty=y+dy;if(tx<0||ty<0||tx>=w||ty>=h)continue;const di=(ty*w+tx)*4;src.copy(frame,di,si,si+4);}}

function motionF2(frame,w,h,motion,index,count){
  if(motion!=='attack')return;
  const poses=[[-2,1,.44,-.16],[-4,2,.50,-.11],[-3,2,.58,-.05],[2,0,.80,0],[1,0,.66,-.03],[0,1,.52,-.10]];
  const [dx,dy,length,slope]=poses[Math.min(index,poses.length-1)];translate(frame,w,h,dx,dy);
  const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,steel=[210,211,201,255],dark=[69,72,70,255];
  const sy=top+bh*(index<3?.59:.55),sx=cx+bw*.04,ex=Math.min(w-8,sx+bw*length),ey=sy+bh*slope;
  line(frame,w,h,cx-bw*.18,sy+2,sx,sy,dark,2,.92);line(frame,w,h,sx,sy,ex,ey,steel,2,1);tri(frame,w,h,[ex+7,ey],[ex-2,ey-6],[ex-2,ey+6],steel,1);
  if(index===1||index===2)line(frame,w,h,cx-bw*.17,top+bh*.43,cx+bw*.03,top+bh*.50,dark,2,.72);
}

function motionF3(frame,w,h,motion,index,count){
  if(motion==='move'){
    const dx=[0,1,2,1,0,-1,-2,-1][index%8]??0,dy=[3,4,5,4,3,4,5,4][index%8]??4;translate(frame,w,h,dx,dy);return;
  }
  if(motion!=='attack')return;
  const dx=[0,2,7,3][index%4]??0,dy=[5,7,4,5][index%4]??5;translate(frame,w,h,dx,dy);
  const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,steel=[160,150,135,255],wrap=[92,86,78,255];
  const lengths=[.24,.29,.40,.28],y=top+bh*.64,x=cx+bw*.05;line(frame,w,h,x-bw*.12,y+3,x,y,wrap,3,.95);line(frame,w,h,x,y,Math.min(w-6,x+bw*lengths[index%4]),y-3,steel,3,1);
}

function drawRaiderSack(frame,w,h,motion,index,count){
  const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,p=index/Math.max(1,count-1);const sack=[116,81,53,255],dark=[72,51,39,255],junk=[177,116,67,255],metal=[119,121,113,255];
  let sx=cx-bw*.31,sy=top+bh*.55;
  if(motion==='knockback'){
    const bodyDx=[0,-3,-7,-10][index]??-10;translate(frame,w,h,bodyDx,Math.round(p*3));sx+=bw*([.02,.15,.24,.29][index]??.29);sy+=bh*([0,.02,.045,.07][index]??.07);
  }else if(motion==='death'){
    const fall=[0,.10,.24,.38,.48,.55][index]??.55;sx-=bw*(.025+Math.min(.07,p*.07));sy+=bh*fall;
  }else return;
  const rx=Math.max(15,bw*.23),ry=Math.max(18,bh*.26);ellipse(frame,w,h,sx,sy,rx,ry,sack,.98);ellipse(frame,w,h,sx-rx*.38,sy-ry*.10,rx*.43,ry*.70,dark,.96);line(frame,w,h,sx-rx*.70,sy-ry*.72,sx-rx*.20,sy-ry*.22,dark,3,1);
  rect(frame,w,h,sx-rx*.67,sy-ry*1.10,sx-rx*.53,sy-ry*.56,junk,1);line(frame,w,h,sx-rx*.10,sy-ry*.98,sx+rx*.18,sy-ry*1.28,metal,3,1);tri(frame,w,h,[sx+rx*.10,sy-ry*.92],[sx+rx*.43,sy-ry*1.17],[sx+rx*.32,sy-ry*.72],junk,1);
}

function apply(target,frame,w,h,motion,index,count){
  if(target.endsWith('militia_f2'))motionF2(frame,w,h,motion,index,count);
  else if(target.endsWith('militia_f3'))motionF3(frame,w,h,motion,index,count);
  else if(target==='enemy-raider')drawRaiderSack(frame,w,h,motion,index,count);
}

const meta=JSON.parse(await readFile(META,'utf8'));
for(const [target,spec] of Object.entries(TARGETS)){
  const entry=meta.targets?.[target];if(!entry)fail(`missing target ${target}`);
  for(const motion of spec.motions){
    const m=entry.motions?.[motion];if(!m)fail(`${target}/${motion} missing metadata`);
    const path=resolve(ROOT,target,`${motion}.png`),bytes=await readFile(path),sheet=decode(bytes,`${target}/${motion}`);
    if(sheet.width!==m.frameWidth*m.frames||sheet.height!==m.frameHeight)fail(`${target}/${motion} dimensions drifted`);
    for(let i=0;i<m.frames;i++){const frame=frameFromSheet(sheet,m.frameWidth,m.frameHeight,i);apply(target,frame,m.frameWidth,m.frameHeight,motion,i,m.frames);putFrame(sheet,frame,m.frameWidth,m.frameHeight,i);}
    const out=encode(sheet.width,sheet.height,sheet.data);await writeFile(path,out);m.bytes=out.length;m.sha256=createHash('sha256').update(out).digest('hex');
  }
  entry.motionLanguage={version:VERSION,kind:'FIRST_SLICE_CHARACTER_MOTION_PASS',reviewStatus:'UNREVIEWED_RUNTIME_FILES',emphasis:spec.emphasis};
}
meta.motionLanguagePipeline={generator:'tools/polish-first-slice-unit-motion-language.mjs',version:VERSION,reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
await writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log(`[production art] first-slice motion language v${VERSION} applied to F2/F3/raider; approval state unchanged`);
