import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const W=1280,H=720;
const header=(title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${title}</title>`;
const footer='</svg>\n';
const themes={
  fortress:{
    stageAnchor:'main_01_004',
    base:`${header('녹슨 방패선 · fortress base')}<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#53606b"/><stop offset="1" stop-color="#a08d72"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><rect y="370" width="1280" height="350" fill="#655c50"/><path d="M0 478 C220 452 350 486 520 468 S900 452 1280 478 L1280 720 L0 720Z" fill="#514a41"/><path d="M250 514 C430 496 820 496 1030 516" fill="none" stroke="#87765f" stroke-width="18" opacity=".55"/>${footer}`,
    background:`${header('fortress background landmarks')}<g opacity=".93"><path d="M0 172 L185 172 L185 332 L248 332 L248 520 L0 520Z" fill="#4b4540"/><path d="M1032 310 L1094 310 L1094 166 L1280 166 L1280 520 L1032 520Z" fill="#49423c"/><path d="M34 172 l28 -30 28 30 28 -30 28 30" fill="none" stroke="#7f7262" stroke-width="18"/><path d="M1132 166 l28 -30 28 30 28 -30 28 30" fill="none" stroke="#7b6d5e" stroke-width="18"/><rect x="180" y="402" width="94" height="18" fill="#8b5d3f" transform="rotate(-9 227 411)"/><rect x="1005" y="405" width="104" height="18" fill="#85593c" transform="rotate(8 1057 414)"/></g>${footer}`,
    foreground:`${header('fortress foreground low density')}<g opacity=".8"><path d="M54 610 l72 -18 40 16 -66 20Z" fill="#776a58"/><path d="M1100 606 l78 -16 38 18 -76 20Z" fill="#746655"/><path d="M180 646 l46 -10 22 11 -50 12Z" fill="#8a765f"/><path d="M1015 650 l54 -12 26 13 -58 12Z" fill="#846f59"/></g>${footer}`,
  },
  burning:{
    stageAnchor:'main_01_005',
    base:`${header('붉은 물결 · burning base')}<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#4b3335"/><stop offset=".58" stop-color="#9a5a3d"/><stop offset="1" stop-color="#b77a4b"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><rect y="386" width="1280" height="334" fill="#5e4437"/><path d="M0 500 C260 470 420 505 640 482 S1000 470 1280 500 L1280 720 L0 720Z" fill="#463732"/><path d="M230 528 C440 506 810 505 1050 530" fill="none" stroke="#7a5540" stroke-width="20" opacity=".52"/>${footer}`,
    background:`${header('burning background landmarks')}<g><path d="M0 366 C92 314 172 300 246 342 L246 520 L0 520Z" fill="#3f3330"/><path d="M1030 340 C1120 298 1202 304 1280 360 L1280 520 L1030 520Z" fill="#3e3230"/><path d="M98 338 C65 286 102 244 86 198 C143 245 142 295 130 342Z" fill="#c36037" opacity=".72"/><path d="M1160 335 C1128 278 1168 244 1150 196 C1210 243 1200 292 1192 340Z" fill="#c45d34" opacity=".7"/><path d="M178 370 C150 322 190 296 178 260 C223 298 218 334 211 374Z" fill="#e18a49" opacity=".58"/></g>${footer}`,
    foreground:`${header('burning foreground low density')}<g opacity=".75"><path d="M72 628 l62 -16 44 18 -78 18Z" fill="#6d4a38"/><path d="M1110 624 l70 -14 40 17 -76 19Z" fill="#684536"/><circle cx="205" cy="662" r="4" fill="#e49b53"/><circle cx="1068" cy="656" r="5" fill="#d98748"/><circle cx="1168" cy="680" r="3" fill="#e3a05a"/></g>${footer}`,
  },
  moon:{
    stageAnchor:'main_01_007',
    base:`${header('유리봉 능선 · moon base')}<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#172238"/><stop offset=".62" stop-color="#35445b"/><stop offset="1" stop-color="#687087"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><circle cx="1050" cy="142" r="76" fill="#d7d8cf" opacity=".9"/><circle cx="1080" cy="122" r="74" fill="#26334a" opacity=".72"/><rect y="390" width="1280" height="330" fill="#39404d"/><path d="M0 520 C240 472 430 506 640 488 S1030 470 1280 516 L1280 720 L0 720Z" fill="#2e3440"/>${footer}`,
    background:`${header('moon background landmarks')}<g opacity=".92"><path d="M0 425 L180 300 L292 430 L292 526 L0 526Z" fill="#28313d"/><path d="M1000 430 L1125 292 L1280 412 L1280 526 L1000 526Z" fill="#27303c"/><path d="M170 318 l34 -58 32 56" fill="none" stroke="#66758c" stroke-width="7"/><path d="M1088 325 l34 -62 34 60" fill="none" stroke="#68788e" stroke-width="7"/><rect x="218" y="356" width="22" height="80" rx="8" fill="#75869b" opacity=".55"/><rect x="1086" y="356" width="20" height="78" rx="8" fill="#75869b" opacity=".5"/></g>${footer}`,
    foreground:`${header('moon foreground low density')}<g opacity=".72"><path d="M65 638 l82 -17 42 16 -90 20Z" fill="#4b5260"/><path d="M1094 638 l82 -17 44 18 -92 20Z" fill="#48505e"/><path d="M196 670 l44 -8 24 10 -50 10Z" fill="#566171"/><path d="M1028 674 l46 -9 22 9 -49 10Z" fill="#535d6c"/></g>${footer}`,
  },
};
const metadata={schemaVersion:1,status:'UNREVIEWED_RUNTIME_FILES',authorship:'ORIGINAL_PROJECT_VECTOR_COMPOSITION',generativeAiUsed:false,humanReview:'PENDING',reviewer:null,reviewedAt:null,themes:{}};
for(const [theme,data] of Object.entries(themes)){
  const dir=resolve(outRoot,theme);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const files={'battlefield-base.svg':data.base,'background-landmarks.svg':data.background,'foreground-low-density.svg':data.foreground};
  for(const [name,content] of Object.entries(files))await writeFile(resolve(dir,name),content);
  metadata.themes[theme]={stageAnchor:data.stageAnchor,files:Object.keys(files).map((name)=>`apps/client/public/assets/production/battlefields/${theme}/${name}`)};
}
await writeFile(resolve(outRoot,'third-slice-battlefield-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[third-slice] materialized ${Object.keys(themes).length} battlefield themes / 9 layers`);
