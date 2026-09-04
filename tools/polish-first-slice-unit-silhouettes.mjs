import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const ROOT = resolve('apps/client/public/assets/production/units');
const META = resolve(ROOT, 'first-slice-runtime-metadata.json');
const VERSION = 1;
const TARGETS = ['militia/militia_f1', 'militia/militia_f2', 'militia/militia_f3', 'enemy-raider'];

function fail(message) { throw new Error(`[first-slice silhouette polish] ${message}`); }
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

function polishF1(frame,w,h,motion,index,count){const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,wave=Math.sin(index*Math.PI/2);const cloth=[146,116,78,255],dark=[66,53,42,255],stitch=[191,157,104,255];
  const beltY=top+bh*.58;line(frame,w,h,cx-bw*.19,beltY,cx+bw*.13,beltY+1,dark,2,.9);rect(frame,w,h,cx-bw*.24,beltY+2,cx-bw*.12,beltY+9,cloth,.95);
  line(frame,w,h,cx-bw*.15,top+bh*.34,cx-bw*.02,top+bh*.48,stitch,1,.85);line(frame,w,h,cx-bw*.13,top+bh*.36,cx-bw*.04,top+bh*.40,stitch,1,.75);
  const tailY=top+bh*.62+(motion==='move'?wave*2:0);tri(frame,w,h,[cx-bw*.22,tailY],[cx-bw*.34,tailY+8],[cx-bw*.17,tailY+10],cloth,.9);
}
function polishF2(frame,w,h,motion,index,count){const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,metal=[205,205,194,255],dark=[58,63,64,255],cloth=[104,104,95,255];
  rect(frame,w,h,cx-bw*.18,top+bh*.30,cx+bw*.14,top+bh*.35,dark,.95);rect(frame,w,h,cx-bw*.22,top+bh*.28,cx-bw*.13,top+bh*.36,metal,.95);rect(frame,w,h,cx+bw*.10,top+bh*.28,cx+bw*.19,top+bh*.36,metal,.95);
  line(frame,w,h,cx-bw*.16,top+bh*.49,cx+bw*.16,top+bh*.49,metal,2,.9);rect(frame,w,h,cx-bw*.22,top+bh*.48,cx-bw*.10,top+bh*.56,cloth,.95);
  const phase=index/Math.max(1,count-1),attack=motion==='attack'?Math.sin(phase*Math.PI):0;const sx=cx+bw*(.10+.08*attack),sy=top+bh*(motion==='attack'?.56:.38);const ex=Math.min(w-7,sx+bw*(motion==='attack'?.66:.48)),ey=sy-bh*(motion==='attack'?.02:.28);
  line(frame,w,h,sx,sy,ex,ey,metal,2,1);tri(frame,w,h,[ex+6,ey],[ex-2,ey-5],[ex-2,ey+5],metal,1);
}
function polishF3(frame,w,h,motion,index,count){const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,repair=[158,144,124,255],dark=[62,58,54,255],wrap=[179,165,141,255];
  line(frame,w,h,cx-bw*.20,top+bh*.35,cx-bw*.05,top+bh*.42,repair,1,.95);line(frame,w,h,cx-bw*.17,top+bh*.38,cx-bw*.03,top+bh*.45,dark,1,.95);
  for(let j=0;j<3;j++)line(frame,w,h,cx-bw*.24,top+bh*(.55+j*.035),cx-bw*.08,top+bh*(.53+j*.035),wrap,1,.9);
  rect(frame,w,h,cx+bw*.03,top+bh*.57,cx+bw*.13,top+bh*.63,dark,.85);
  if(motion==='attack'){const phase=index/Math.max(1,count-1),push=Math.sin(phase*Math.PI)*bw*.10,y=top+bh*.61,x=cx+bw*.10+push;line(frame,w,h,x,y,Math.min(w-6,x+bw*.28),y-2,repair,2,1);}
}
function polishRaider(frame,w,h,motion,index,count){const b=bbox(frame,w,h),cx=(b.minX+b.maxX)/2,top=b.minY,bw=b.width,bh=b.height,p=index/Math.max(1,count-1),wave=Math.sin(index*Math.PI/2);const sack=[119,84,55,255],sackDark=[74,54,41,255],junk=[181,122,70,255],metal=[117,119,111,255];
  const lagX=motion==='knockback'?bw*(.06+.08*p):motion==='death'?-bw*.04*p:0;const lagY=motion==='move'?wave*3:motion==='death'?bh*.16*p:motion==='knockback'?bh*.03*p:0;const sx=cx-bw*.30+lagX,sy=top+bh*.54+lagY,rx=Math.max(14,bw*.22),ry=Math.max(17,bh*.25);
  ellipse(frame,w,h,sx,sy,rx,ry,sack,.97);ellipse(frame,w,h,sx-rx*.38,sy-ry*.12,rx*.45,ry*.68,sackDark,.95);line(frame,w,h,sx-rx*.72,sy-ry*.75,sx-rx*.22,sy-ry*.24,sackDark,3,1);
  rect(frame,w,h,sx-rx*.68,sy-ry*1.12,sx-rx*.54,sy-ry*.56,junk,1);line(frame,w,h,sx-rx*.12,sy-ry*.98,sx+rx*.16,sy-ry*1.30,metal,3,1);tri(frame,w,h,[sx+rx*.08,sy-ry*.92],[sx+rx*.42,sy-ry*1.18],[sx+rx*.32,sy-ry*.72],junk,1);
  line(frame,w,h,sx+rx*.42,sy-ry*.60,cx+bw*.04,top+bh*.48,junk,2,.95);
  const attack=motion==='attack'?Math.sin(p*Math.PI):0,x=cx+bw*(.08+.08*attack),y=top+bh*.61;line(frame,w,h,x,y,Math.min(w-5,x+bw*.22),y+2,sackDark,3,1);
}
function polish(target,frame,w,h,motion,index,count){if(target.endsWith('militia_f1'))polishF1(frame,w,h,motion,index,count);else if(target.endsWith('militia_f2'))polishF2(frame,w,h,motion,index,count);else if(target.endsWith('militia_f3'))polishF3(frame,w,h,motion,index,count);else if(target==='enemy-raider')polishRaider(frame,w,h,motion,index,count);}

const meta=JSON.parse(await readFile(META,'utf8'));
for(const target of TARGETS){const entry=meta.targets[target];if(!entry)fail(`missing metadata target ${target}`);for(const [motion,m] of Object.entries(entry.motions)){const path=resolve(ROOT,target,`${motion}.png`),bytes=await readFile(path),sheet=decode(bytes,`${target}/${motion}`);if(sheet.width!==m.frameWidth*m.frames||sheet.height!==m.frameHeight)fail(`${target}/${motion} dimensions drifted`);for(let i=0;i<m.frames;i++){const frame=frameFromSheet(sheet,m.frameWidth,m.frameHeight,i);polish(target,frame,m.frameWidth,m.frameHeight,motion,i,m.frames);putFrame(sheet,frame,m.frameWidth,m.frameHeight,i);}const out=encode(sheet.width,sheet.height,sheet.data);await writeFile(path,out);m.bytes=out.length;m.sha256=createHash('sha256').update(out).digest('hex');}entry.visualPolish={version:VERSION,kind:'STRUCTURAL_SILHOUETTE_PASS',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};}
meta.visualPolishPipeline={generator:'tools/polish-first-slice-unit-silhouettes.mjs',version:VERSION,reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
await writeFile(META,JSON.stringify(meta,null,2)+'\n');
console.log(`[production art] silhouette polish v${VERSION} applied to ${TARGETS.length} runtime candidates; approval state unchanged`);
