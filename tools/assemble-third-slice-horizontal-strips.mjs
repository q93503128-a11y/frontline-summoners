import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const metaPath=resolve(root,'apps/client/public/assets/production/units/third-slice-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metaPath,'utf8'));
for(const target of Object.values(metadata.targets??{})){
  for(const motion of Object.values(target.motions??{})){
    const path=resolve(root,motion.file),bytes=await readFile(path),decoded=decodePng(bytes,motion.file);
    const frameWidth=target.frameWidth,frameHeight=target.frameHeight,frames=motion.frames;
    if(decoded.width!==frameWidth*frames||decoded.height!==frameHeight)throw new Error(`[third-slice strip assemble] unexpected staged dimensions ${motion.file}`);
    const frameBytes=frameWidth*frameHeight*4,wide=Buffer.alloc(frameWidth*frames*frameHeight*4);
    for(let frameIndex=0;frameIndex<frames;frameIndex++){
      const frameStart=frameIndex*frameBytes;
      for(let y=0;y<frameHeight;y++){
        const srcStart=frameStart+y*frameWidth*4;
        const dstStart=(y*frameWidth*frames+frameIndex*frameWidth)*4;
        decoded.data.copy(wide,dstStart,srcStart,srcStart+frameWidth*4);
      }
    }
    const finalPng=encodePng(frameWidth*frames,frameHeight,wide);
    await writeFile(path,finalPng);
    motion.bytes=finalPng.length;
    motion.sha256=sha256(finalPng);
  }
}
metadata.assemblyPass='HORIZONTAL_SCANLINE_STRIP_V1';
await writeFile(metaPath,JSON.stringify(metadata,null,2)+'\n');
console.log('[third-slice] assembled horizontal sprite-sheet scanlines and refreshed metadata hashes');
