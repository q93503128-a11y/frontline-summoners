import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'apps/client/public/assets/characters');
const outputRoot = resolve(root, 'apps/client/public/assets/production/units');
const contractPath = resolve(root, 'assets/raw/production/second-slice-early-wave-02.json');
const GENERATOR_VERSION = 1;

const VLEE = 'https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';

const SOURCES = {
  'hero-knight': {
    original: {
      idle: `${VLEE}/HeroKnight/Idle.png`, move: `${VLEE}/HeroKnight/Run.png`, attack: `${VLEE}/HeroKnight/Attack1.png`, knockback: `${VLEE}/HeroKnight/Take%20Hit.png`, death: `${VLEE}/HeroKnight/Death.png`,
    },
    local: { idle: 'hero-knight/idle.png', move: 'hero-knight/run.png', attack: 'hero-knight/attack.png', knockback: 'hero-knight/hit.png', death: 'hero-knight/death.png' },
    frameWidth: 180, frameHeight: 180, frames: { idle: 11, move: 8, attack: 7, knockback: 4, death: 11 },
  },
  'huntress-2': {
    original: {
      idle: `${NQM}/Huntress%202/Sprites/Character/Idle.png`, move: `${NQM}/Huntress%202/Sprites/Character/Run.png`, attack: `${NQM}/Huntress%202/Sprites/Character/Attack.png`, knockback: `${NQM}/Huntress%202/Sprites/Character/Get%20Hit.png`, death: `${NQM}/Huntress%202/Sprites/Character/Death.png`,
    },
    local: { idle: 'huntress-2/idle.png', move: 'huntress-2/run.png', attack: 'huntress-2/attack.png', knockback: 'huntress-2/hit.png', death: 'huntress-2/death.png' },
    frameWidth: 100, frameHeight: 100, frames: { idle: 10, move: 8, attack: 6, knockback: 3, death: 10 },
  },
  'fantasy-warrior': {
    original: {
      idle: `${NQM}/Fantasy%20Warrior/Sprites/Idle.png`, move: `${NQM}/Fantasy%20Warrior/Sprites/Run.png`, attack: `${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`, knockback: `${NQM}/Fantasy%20Warrior/Sprites/Take%20hit.png`, death: `${NQM}/Fantasy%20Warrior/Sprites/Death.png`,
    },
    local: { idle: 'fantasy-warrior/idle.png', move: 'fantasy-warrior/run.png', attack: 'fantasy-warrior/attack.png', knockback: 'fantasy-warrior/hit.png', death: 'fantasy-warrior/death.png' },
    frameWidth: 162, frameHeight: 162, frames: { idle: 10, move: 8, attack: 7, knockback: 3, death: 7 },
  },
  'king-2': {
    original: {
      idle: `${NQM}/Medieval%20King%20Pack%202/Sprites/Idle.png`, move: `${NQM}/Medieval%20King%20Pack%202/Sprites/Run.png`, attack: `${NQM}/Medieval%20King%20Pack%202/Sprites/Attack1.png`, knockback: `${NQM}/Medieval%20King%20Pack%202/Sprites/Take%20Hit.png`, death: `${NQM}/Medieval%20King%20Pack%202/Sprites/Death.png`,
    },
    local: { idle: 'king-2/idle.png', move: 'king-2/run.png', attack: 'king-2/attack.png', knockback: 'king-2/hit.png', death: 'king-2/death.png' },
    frameWidth: 160, frameHeight: 111, frames: { idle: 8, move: 8, attack: 4, knockback: 4, death: 6 },
  },
};

const TARGETS = {
  'guard/guard_f1': { assetId: 'unit:guard:guard_f1', sourceFamily: 'hero-knight', kind: 'guard', form: 1, displayHeight: 184, attackContactFrame: 3, outW: 210, outH: 190, dx: 12, dy: 5, palette: [102, 91, 78] },
  'guard/guard_f2': { assetId: 'unit:guard:guard_f2', sourceFamily: 'hero-knight', kind: 'guard', form: 2, displayHeight: 192, attackContactFrame: 3, outW: 210, outH: 190, dx: 12, dy: 5, palette: [88, 82, 72] },
  'guard/guard_f3': { assetId: 'unit:guard:guard_f3', sourceFamily: 'hero-knight', kind: 'guard', form: 3, displayHeight: 202, attackContactFrame: 3, outW: 210, outH: 190, dx: 12, dy: 5, palette: [76, 74, 70] },
  'hunter/hunter_f1': { assetId: 'unit:hunter:hunter_f1', sourceFamily: 'huntress-2', kind: 'hunter', form: 1, displayHeight: 180, attackContactFrame: 3, outW: 190, outH: 120, dx: 18, dy: 10, palette: [93, 91, 70] },
  'hunter/hunter_f2': { assetId: 'unit:hunter:hunter_f2', sourceFamily: 'huntress-2', kind: 'hunter', form: 2, displayHeight: 184, attackContactFrame: 3, outW: 190, outH: 120, dx: 18, dy: 10, palette: [88, 78, 61] },
  'hunter/hunter_f3': { assetId: 'unit:hunter:hunter_f3', sourceFamily: 'huntress-2', kind: 'hunter', form: 3, displayHeight: 188, attackContactFrame: 3, outW: 190, outH: 120, dx: 18, dy: 10, palette: [78, 76, 68] },
  'enemy-spearman': { assetId: 'unit:enemy-spearman', sourceFamily: 'fantasy-warrior', kind: 'enemy-spearman', form: 1, displayHeight: 188, attackContactFrame: 3, outW: 230, outH: 175, dx: 18, dy: 6, palette: [87, 67, 62] },
  'enemy-shield': { assetId: 'unit:enemy-shield', sourceFamily: 'king-2', kind: 'enemy-shield', form: 1, displayHeight: 190, attackContactFrame: 2, outW: 200, outH: 130, dx: 12, dy: 10, palette: [95, 79, 61] },
};

function fail(message) { throw new Error(`[second-slice materialize] ${message}`); }
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(bytes,label){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)fail(`${label} not PNG`);
  let o=8,w=0,h=0,bd=0,ct=0,interlace=0;const id=[];
  while(o+12<=bytes.length){const n=bytes.readUInt32BE(o),t=bytes.toString('ascii',o+4,o+8),d=bytes.subarray(o+8,o+8+n);o+=12+n;if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];interlace=d[12];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;}
  if(bd!==8||interlace!==0)fail(`${label} unsupported PNG encoding`);
  const channels=ct===6?4:ct===2?3:ct===4?2:ct===0?1:0;if(!channels)fail(`${label} unsupported PNG colorType=${ct}`);
  const rb=w*channels,raw=inflateSync(Buffer.concat(id)),scan=Buffer.alloc(rb*h);let s=0;
  for(let y=0;y<h;y++){const f=raw[s++],row=scan.subarray(y*rb,(y+1)*rb),prev=y?scan.subarray((y-1)*rb,y*rb):null;for(let x=0;x<rb;x++){const v=raw[s++],l=x>=channels?row[x-channels]:0,u=prev?prev[x]:0,ul=prev&&x>=channels?prev[x-channels]:0;row[x]=f===0?v:f===1?(v+l)&255:f===2?(v+u)&255:f===3?(v+Math.floor((l+u)/2))&255:f===4?(v+paeth(l,u,ul))&255:fail(`${label} invalid filter ${f}`);}}
  const rgba=Buffer.alloc(w*h*4);for(let i=0,p=0;i<w*h;i++,p+=channels){const d=i*4;if(ct===6){rgba[d]=scan[p];rgba[d+1]=scan[p+1];rgba[d+2]=scan[p+2];rgba[d+3]=scan[p+3];}else if(ct===2){rgba[d]=scan[p];rgba[d+1]=scan[p+1];rgba[d+2]=scan[p+2];rgba[d+3]=255;}else if(ct===4){rgba[d]=scan[p];rgba[d+1]=scan[p];rgba[d+2]=scan[p];rgba[d+3]=scan[p+1];}else{rgba[d]=scan[p];rgba[d+1]=scan[p];rgba[d+2]=scan[p];rgba[d+3]=255;}}
  return {width:w,height:h,data:rgba};
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d){const tb=Buffer.from(t),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(d.length);crc.writeUInt32BE(crc32(Buffer.concat([tb,d])));return Buffer.concat([len,tb,d,crc]);}
function encodePng(w,h,p){const sig=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const d=y*(w*4+1);raw[d]=0;p.copy(raw,d+1,y*w*4,(y+1)*w*4);}return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
function blend(b,w,h,x,y,c,a=1){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4,sa=(c[3]??255)/255*a,da=b[i+3]/255,oa=sa+da*(1-sa);if(oa<=0)return;for(let k=0;k<3;k++)b[i+k]=Math.round((c[k]*sa+b[i+k]*da*(1-sa))/oa);b[i+3]=Math.round(oa*255);}
function rect(b,w,h,x0,y0,x1,y1,c,a=1){for(let y=Math.round(y0);y<=Math.round(y1);y++)for(let x=Math.round(x0);x<=Math.round(x1);x++)blend(b,w,h,x,y,c,a);}
function line(b,w,h,x0,y0,x1,y1,c,th=1,a=1){const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy),1);for(let i=0;i<=n;i++){const x=x0+dx*i/n,y=y0+dy*i/n;rect(b,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c,a);}}
function ellipse(b,w,h,cx,cy,rx,ry,c,a=1){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)blend(b,w,h,x,y,c,a);}
function tri(b,w,h,a,p,c,col,alpha=1){const minX=Math.floor(Math.min(a[0],p[0],c[0])),maxX=Math.ceil(Math.max(a[0],p[0],c[0])),minY=Math.floor(Math.min(a[1],p[1],c[1])),maxY=Math.ceil(Math.max(a[1],p[1],c[1]));const area=(u,v,z)=>(v[0]-u[0])*(z[1]-u[1])-(v[1]-u[1])*(z[0]-u[0]);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const q=[x,y],s1=area(a,p,q),s2=area(p,c,q),s3=area(c,a,q);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))blend(b,w,h,x,y,col,alpha);}}
function sourceFrame(sheet,fw,fh,index){const f=Buffer.alloc(fw*fh*4);for(let y=0;y<fh;y++){const s=((y*sheet.width)+index*fw)*4;sheet.data.copy(f,y*fw*4,s,s+fw*4);}return f;}
function grade([r,g,b,a],palette){const lum=(r*.2126+g*.7152+b*.0722)/255,m=.16;return[Math.round(r*(1-m)+palette[0]*m*(.7+.3*lum)),Math.round(g*(1-m)+palette[1]*m*(.7+.3*lum)),Math.round(b*(1-m)+palette[2]*m*(.7+.3*lum)),a];}
function blitSource(out,w,h,src,sw,sh,dx,dy,palette,shiftX=0,shiftY=0){for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4,a=src[i+3];if(a<8)continue;blend(out,w,h,x+dx+shiftX,y+dy+shiftY,grade([src[i],src[i+1],src[i+2],a],palette),1);}}

function drawGuard(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),wave=Math.sin(index*Math.PI/2),steel=[94,96,94,255],wood=[107,78,51,255],edge=[181,169,137,255],dark=[54,48,43,255];
  const bodyShift=motion==='knockback'?-Math.round(p*7):motion==='death'?Math.round(p*3):0;
  const bodyDrop=motion==='death'?Math.round(p*14):motion==='move'?(index%2):0;
  const shieldPush=motion==='attack'?Math.round(Math.sin(p*Math.PI)*10):0;
  const shieldLag=motion==='knockback'?Math.round(p*4):0;
  const cx=107+shieldPush+shieldLag,baseY=108+(motion==='move'?wave*1.5:0)+(motion==='death'?Math.round(p*28):0);
  const width=spec.form===1?43:spec.form===2?50:58,height=spec.form===1?82:spec.form===2?88:96;
  const top=baseY-height/2;
  rect(out,spec.outW,spec.outH,cx-width/2,top,cx+width/2,baseY+height/2,wood,.98);
  rect(out,spec.outW,spec.outH,cx-width/2,top,cx-width/2+5,baseY+height/2,steel,1);
  rect(out,spec.outW,spec.outH,cx+width/2-5,top,cx+width/2,baseY+height/2,steel,1);
  line(out,spec.outW,spec.outH,cx-width*.36,baseY,cx+width*.36,baseY,edge,2,.9);
  if(spec.form>=2){for(let j=-1;j<=1;j++)rect(out,spec.outW,spec.outH,cx+j*15-5,top-6,cx+j*15+5,top+5,wood,1);line(out,spec.outW,spec.outH,cx-width*.38,top+18,cx+width*.38,top+18,steel,2,.9);}
  if(spec.form===3){rect(out,spec.outW,spec.outH,cx-width*.48,baseY+height/2-5,cx+width*.48,baseY+height/2+4,steel,1);ellipse(out,spec.outW,spec.outH,cx-width*.28,baseY+height/2+6,6,5,dark,1);ellipse(out,spec.outW,spec.outH,cx+width*.28,baseY+height/2+6,6,5,dark,1);}
  if(motion==='attack'){const x1=cx+width/2-2,y=baseY-4;line(out,spec.outW,spec.outH,x1,y,x1+22,y+3,dark,4,1);rect(out,spec.outW,spec.outH,x1+19,y-4,x1+25,y+7,steel,1);}
  if(motion==='knockback'){line(out,spec.outW,spec.outH,cx-width/2,baseY+height/2+4,cx+width/2+10,baseY+height/2+8,edge,2,.45);}
  return {bodyShift,bodyDrop};
}

function drawHunter(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),steel=[173,177,166,255],wood=[92,67,49,255],leather=[117,84,58,255],mark=[179,146,82,255];
  const attack=Math.sin(p*Math.PI),bodyShift=motion==='attack'?Math.round(attack*4):motion==='knockback'?-Math.round(p*4):0,bodyDrop=motion==='death'?Math.round(p*13):0;
  const y=motion==='death'?82+Math.round(p*20):motion==='knockback'?72:64+(spec.form===3?-2:0);
  const x1=58+bodyShift+(motion==='attack'?Math.round(attack*7):0);
  const baseLength=spec.form===1?103:spec.form===2?122:142;
  const extension=motion==='attack'?Math.round(attack*(spec.form===3?12:9)):0;
  const x2=Math.min(spec.outW-8,x1+baseLength+extension);
  const tipY=y-(motion==='attack'?3:spec.form===3?1:5);
  if(motion==='knockback'){line(out,spec.outW,spec.outH,x1,y+12,x1+62,25,wood,3,1);tri(out,spec.outW,spec.outH,[x1+66,22],[x1+57,25],[x1+62,32],steel,1);}else{
    line(out,spec.outW,spec.outH,x1,y,x2,tipY,wood,3,1);tri(out,spec.outW,spec.outH,[x2+7,tipY],[x2-2,tipY-6],[x2-2,tipY+6],steel,1);
    if(spec.form===2){line(out,spec.outW,spec.outH,x2-6,tipY,x2-14,tipY+9,steel,2,1);tri(out,spec.outW,spec.outH,[x2-12,tipY+9],[x2-17,tipY+2],[x2-7,tipY+4],steel,1);}
    if(spec.form===3){line(out,spec.outW,spec.outH,x1+55,y-1,x1+55,y+13,mark,2,.95);tri(out,spec.outW,spec.outH,[x1+57,y+3],[x1+70,y+8],[x1+57,y+13],mark,.95);}
  }
  line(out,spec.outW,spec.outH,72+bodyShift,42+bodyDrop,54+bodyShift,58+bodyDrop,leather,2,.8);
  if(spec.form>=2){tri(out,spec.outW,spec.outH,[64+bodyShift,37+bodyDrop],[55+bodyShift,30+bodyDrop],[61+bodyShift,47+bodyDrop],leather,.9);}
  return {bodyShift,bodyDrop};
}

function drawEnemySpearman(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),attack=Math.sin(p*Math.PI),steel=[155,151,141,255],shaft=[76,55,48,255],cloth=[116,62,57,255];
  const bodyShift=motion==='attack'?Math.round(attack*5):motion==='knockback'?-Math.round(p*6):0,bodyDrop=motion==='death'?Math.round(p*15):0;
  const x1=88+bodyShift,y=88+(motion==='death'?Math.round(p*15):0),length=126+(motion==='attack'?Math.round(attack*18):0),x2=Math.min(spec.outW-9,x1+length);
  line(out,spec.outW,spec.outH,x1,y,x2,y-4,shaft,3,1);tri(out,spec.outW,spec.outH,[x2+8,y-4],[x2-2,y-11],[x2-2,y+3],steel,1);
  rect(out,spec.outW,spec.outH,70+bodyShift,45+bodyDrop,82+bodyShift,70+bodyDrop,cloth,.8);
  line(out,spec.outW,spec.outH,68+bodyShift,46+bodyDrop,57+bodyShift,35+bodyDrop,steel,2,.9);
  if(motion==='knockback')line(out,spec.outW,spec.outH,x1-8,y+6,x1+20,y+22,steel,2,.55);
  return {bodyShift,bodyDrop};
}

function drawEnemyShield(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),attack=Math.sin(p*Math.PI),iron=[116,111,101,255],dark=[67,61,54,255],rust=[139,83,52,255];
  const bodyShift=motion==='knockback'?-Math.round(p*6):0,bodyDrop=motion==='death'?Math.round(p*11):0;
  const sx=112+(motion==='attack'?Math.round(attack*7):motion==='knockback'?Math.round(p*3):0),sy=76+(motion==='death'?Math.round(p*28):0);
  ellipse(out,spec.outW,spec.outH,sx,sy,39,43,iron,.98);ellipse(out,spec.outW,spec.outH,sx,sy,31,35,dark,.28);ellipse(out,spec.outW,spec.outH,sx-11,sy-8,6,5,dark,.9);ellipse(out,spec.outW,spec.outH,sx+13,sy+9,5,4,rust,.9);line(out,spec.outW,spec.outH,sx-23,sy+17,sx+18,sy-20,rust,2,.7);
  if(motion==='attack'){line(out,spec.outW,spec.outH,sx+29,sy-2,sx+49,sy+2,dark,4,1);}
  if(motion==='death')line(out,spec.outW,spec.outH,sx-38,sy+43,sx+38,sy+46,rust,2,.45);
  return {bodyShift,bodyDrop};
}

function renderFrame(src,spec,motion,index,count){
  const out=Buffer.alloc(spec.outW*spec.outH*4);
  let movement={bodyShift:0,bodyDrop:0};
  if(spec.kind==='guard') movement=drawGuard(out,spec,motion,index,count);
  else if(spec.kind==='hunter') movement=drawHunter(out,spec,motion,index,count);
  else if(spec.kind==='enemy-spearman') movement=drawEnemySpearman(out,spec,motion,index,count);
  else if(spec.kind==='enemy-shield') movement=drawEnemyShield(out,spec,motion,index,count);
  blitSource(out,spec.outW,spec.outH,src,SOURCES[spec.sourceFamily].frameWidth,SOURCES[spec.sourceFamily].frameHeight,spec.dx,spec.dy,spec.palette,movement.bodyShift,movement.bodyDrop);
  if(spec.kind==='guard') drawGuard(out,spec,motion,index,count);
  else if(spec.kind==='hunter') drawHunter(out,spec,motion,index,count);
  else if(spec.kind==='enemy-spearman') drawEnemySpearman(out,spec,motion,index,count);
  else if(spec.kind==='enemy-shield') drawEnemyShield(out,spec,motion,index,count);
  return out;
}

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART')fail('second-slice contract must remain AWAITING_ART during materialization');
await mkdir(outputRoot,{recursive:true});
const metadata={schemaVersion:1,batchId:contract.batchId,generator:'tools/materialize-second-slice-production-art.mjs',generatorVersion:GENERATOR_VERSION,reviewStatus:'UNREVIEWED_RUNTIME_FILES',structuralRework:true,targets:{}};
for(const [target,spec] of Object.entries(TARGETS)){
  const source=SOURCES[spec.sourceFamily];if(!source)fail(`${target} missing source family`);
  const dir=resolve(outputRoot,target);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  metadata.targets[target]={assetId:spec.assetId,sourceFamily:spec.sourceFamily,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,structuralRework:true,reviewStatus:'UNREVIEWED_RUNTIME_FILES',motions:{}};
  for(const motion of ['idle','move','attack','knockback','death']){
    const frames=source.frames[motion],fw=source.frameWidth,fh=source.frameHeight;
    const sourcePath=resolve(sourceRoot,source.local[motion]);const sourceBytes=await readFile(sourcePath);const sheet=decodePng(sourceBytes,`${target}/${motion}`);
    if(sheet.width!==fw*frames||sheet.height!==fh)fail(`${target}/${motion} source dimensions changed: expected ${fw*frames}x${fh}, got ${sheet.width}x${sheet.height}`);
    const strip=Buffer.alloc(spec.outW*frames*spec.outH*4);
    for(let i=0;i<frames;i++){
      const frame=renderFrame(sourceFrame(sheet,fw,fh,i),spec,motion,i,frames);
      for(let y=0;y<spec.outH;y++){const d=((y*(spec.outW*frames))+i*spec.outW)*4;frame.copy(strip,d,y*spec.outW*4,(y+1)*spec.outW*4);}
    }
    const bytes=encodePng(spec.outW*frames,spec.outH,strip),file=`${motion}.png`;await writeFile(resolve(dir,file),bytes);
    metadata.targets[target].motions[motion]={url:`/assets/production/units/${target}/${file}`,frameWidth:spec.outW,frameHeight:spec.outH,frames,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sourceUrl:source.original[motion],sourceLocalPath:`/assets/characters/${source.local[motion]}`};
  }
}
await writeFile(resolve(outputRoot,'second-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[production art] second slice ${Object.keys(TARGETS).length} targets × 5 motions materialized as unreviewed deterministic CC0 reworks; lifecycle remains AWAITING_ART`);
