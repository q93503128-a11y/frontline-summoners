import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const dir=resolve(outRoot,'golden');
const W=1280,H=720;
const header=(title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${title}</title>`;
const footer='</svg>\n';
const base=`${header('긴 시야 · golden base')}<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#8a96a1"/><stop offset=".52" stop-color="#d4bc7b"/><stop offset="1" stop-color="#d5a85e"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stop-color="#ae9250"/><stop offset="1" stop-color="#665c3f"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><rect y="386" width="1280" height="334" fill="url(#ground)"/><path d="M0 486 C205 455 365 488 536 470 S905 454 1280 486 L1280 720 L0 720Z" fill="#756946"/><path d="M180 528 C420 500 835 500 1100 528" fill="none" stroke="#bca267" stroke-width="18" opacity=".55"/><path d="M356 560 C520 542 742 542 914 559" fill="none" stroke="#d2bb7c" stroke-width="7" opacity=".34"/>${footer}`;
const background=`${header('golden background landmarks')}<g opacity=".9"><path d="M0 410 C95 338 190 330 284 388 L284 525 L0 525Z" fill="#6e684d"/><path d="M1002 390 C1095 328 1190 326 1280 398 L1280 525 L1002 525Z" fill="#6a654b"/><path d="M146 336 L146 208 L168 208 L168 333" stroke="#5e5948" stroke-width="8"/><path d="M1120 334 L1120 196 L1142 196 L1142 332" stroke="#5c5747" stroke-width="8"/><path d="M118 214 L196 214 L182 236 L132 236Z" fill="#c5ad6c"/><path d="M1092 202 L1175 202 L1160 226 L1107 226Z" fill="#c6ae6d"/><path d="M72 356 C105 318 129 317 156 354" fill="none" stroke="#8b7c54" stroke-width="10"/><path d="M1170 356 C1193 318 1222 319 1252 359" fill="none" stroke="#877850" stroke-width="10"/></g>${footer}`;
const foreground=`${header('golden foreground low density')}<g opacity=".76"><path d="M58 626 l78 -16 45 17 -86 20Z" fill="#806f49"/><path d="M1096 628 l76 -15 43 18 -84 19Z" fill="#7b6c48"/><path d="M184 660 l52 -9 28 11 -58 11Z" fill="#947f52"/><path d="M1018 660 l56 -9 28 11 -62 11Z" fill="#907b50"/><path d="M102 602 q8 -34 13 0 M128 606 q10 -38 16 0 M1150 605 q8 -34 14 0 M1184 607 q9 -36 15 0" stroke="#c1a85f" stroke-width="4" fill="none"/></g>${footer}`;
await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,'battlefield-base.svg'),base);await writeFile(resolve(dir,'background-landmarks.svg'),background);await writeFile(resolve(dir,'foreground-low-density.svg'),foreground);
const metadata={schemaVersion:1,sliceId:'fourth-slice-mid-wave-04',status:'UNREVIEWED_RUNTIME_FILES',authorship:'ORIGINAL_PROJECT_VECTOR_COMPOSITION',generativeAiUsed:false,humanReview:'PENDING',reviewer:null,reviewedAt:null,theme:'golden',stageAnchor:'main_01_011',clearCorridor:{xMin:360,xMax:930},files:['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']};
await writeFile(resolve(outRoot,'fourth-slice-battlefield-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('[fourth-slice] materialized golden battlefield / 3 layers');
