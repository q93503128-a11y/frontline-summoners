import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export function fail(scope, message) { throw new Error(`[${scope}] ${message}`); }
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
export function decodePng(bytes,label='png'){
  if(bytes.length<24||bytes.readUInt32BE(0)!==0x89504e47)throw new Error(`${label} not PNG`);
  let o=8,w=0,h=0,bd=0,ct=0,interlace=0;const id=[];
  while(o+12<=bytes.length){const n=bytes.readUInt32BE(o),t=bytes.toString('ascii',o+4,o+8),d=bytes.subarray(o+8,o+8+n);o+=12+n;if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];interlace=d[12];}else if(t==='IDAT')id.push(d);else if(t==='IEND')break;}
  if(bd!==8||interlace!==0)throw new Error(`${label} unsupported PNG encoding`);
  const channels=ct===6?4:ct===2?3:ct===4?2:ct===0?1:0;if(!channels)throw new Error(`${label} unsupported PNG colorType=${ct}`);
  const rb=w*channels,raw=inflateSync(Buffer.concat(id)),scan=Buffer.alloc(rb*h);let s=0;
  for(let y=0;y<h;y++){const f=raw[s++],row=scan.subarray(y*rb,(y+1)*rb),prev=y?scan.subarray((y-1)*rb,y*rb):null;for(let x=0;x<rb;x++){const v=raw[s++],l=x>=channels?row[x-channels]:0,u=prev?prev[x]:0,ul=prev&&x>=channels?prev[x-channels]:0;row[x]=f===0?v:f===1?(v+l)&255:f===2?(v+u)&255:f===3?(v+Math.floor((l+u)/2))&255:f===4?(v+paeth(l,u,ul))&255:(()=>{throw new Error(`${label} invalid PNG filter ${f}`)})();}}
  const rgba=Buffer.alloc(w*h*4);for(let i=0,p=0;i<w*h;i++,p+=channels){const d=i*4;if(ct===6){rgba[d]=scan[p];rgba[d+1]=scan[p+1];rgba[d+2]=scan[p+2];rgba[d+3]=scan[p+3];}else if(ct===2){rgba[d]=scan[p];rgba[d+1]=scan[p+1];rgba[d+2]=scan[p+2];rgba[d+3]=255;}else if(ct===4){rgba[d]=scan[p];rgba[d+1]=scan[p];rgba[d+2]=scan[p];rgba[d+3]=scan[p+1];}else{rgba[d]=scan[p];rgba[d+1]=scan[p];rgba[d+2]=scan[p];rgba[d+3]=255;}}
  return {width:w,height:h,data:rgba};
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(t,d){const tb=Buffer.from(t),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(d.length);crc.writeUInt32BE(crc32(Buffer.concat([tb,d])));return Buffer.concat([len,tb,d,crc]);}
export function encodePng(w,h,p){const sig=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const d=y*(w*4+1);raw[d]=0;p.copy(raw,d+1,y*w*4,(y+1)*w*4);}return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
export function blend(b,w,h,x,y,c,a=1){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=h)return;const i=(y*w+x)*4,sa=(c[3]??255)/255*a,da=b[i+3]/255,oa=sa+da*(1-sa);if(oa<=0)return;for(let k=0;k<3;k++)b[i+k]=Math.round((c[k]*sa+b[i+k]*da*(1-sa))/oa);b[i+3]=Math.round(oa*255);}
export function rect(b,w,h,x0,y0,x1,y1,c,a=1){for(let y=Math.round(y0);y<=Math.round(y1);y++)for(let x=Math.round(x0);x<=Math.round(x1);x++)blend(b,w,h,x,y,c,a);}
export function line(b,w,h,x0,y0,x1,y1,c,th=1,a=1){const dx=x1-x0,dy=y1-y0,n=Math.max(Math.ceil(Math.abs(dx)),Math.ceil(Math.abs(dy)),1);for(let i=0;i<=n;i++){const x=x0+dx*i/n,y=y0+dy*i/n;rect(b,w,h,x-th/2,y-th/2,x+th/2,y+th/2,c,a);}}
export function ellipse(b,w,h,cx,cy,rx,ry,c,a=1){for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)**2)/(rx*rx)+((y-cy)**2)/(ry*ry)<=1)blend(b,w,h,x,y,c,a);}
export function triangle(b,w,h,a,p,c,col,alpha=1){const minX=Math.floor(Math.min(a[0],p[0],c[0])),maxX=Math.ceil(Math.max(a[0],p[0],c[0])),minY=Math.floor(Math.min(a[1],p[1],c[1])),maxY=Math.ceil(Math.max(a[1],p[1],c[1]));const area=(u,v,z)=>(v[0]-u[0])*(z[1]-u[1])-(v[1]-u[1])*(z[0]-u[0]);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const q=[x,y],s1=area(a,p,q),s2=area(p,c,q),s3=area(c,a,q);if((s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0))blend(b,w,h,x,y,col,alpha);}}
export function sourceFrame(sheet,fw,fh,index){const f=Buffer.alloc(fw*fh*4);for(let y=0;y<fh;y++){const s=((y*sheet.width)+index*fw)*4;sheet.data.copy(f,y*fw*4,s,s+fw*4);}return f;}
export function gradePixel([r,g,b,a],palette,m=.16){const lum=(r*.2126+g*.7152+b*.0722)/255;return[Math.round(r*(1-m)+palette[0]*m*(.7+.3*lum)),Math.round(g*(1-m)+palette[1]*m*(.7+.3*lum)),Math.round(b*(1-m)+palette[2]*m*(.7+.3*lum)),a];}
export function blitSource(out,w,h,src,sw,sh,dx,dy,palette,shiftX=0,shiftY=0,m=.16){for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4,a=src[i+3];if(a<8)continue;blend(out,w,h,x+dx+shiftX,y+dy+shiftY,gradePixel([src[i],src[i+1],src[i+2],a],palette,m),1);}}
export function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
export async function fetchPinnedPng(url, expectedWidth, expectedHeight, label=url){const response=await fetch(url,{headers:{'user-agent':'frontline-summoners-build/1.0'},redirect:'follow'});if(!response.ok)throw new Error(`${label} HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());const png=decodePng(bytes,label);if(png.width!==expectedWidth||png.height!==expectedHeight)throw new Error(`${label} expected ${expectedWidth}x${expectedHeight}, got ${png.width}x${png.height}`);return {bytes,png};}
