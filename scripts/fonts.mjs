// Extracts DFB SANS VAR Italic from Archive.zip into fonts/ (git-ignored).
// The font is licensed ("You may not sell or give away this font"), so the
// repository keeps it only inside the supplied archive; builds unpack it locally.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = join(root, 'Archive.zip');
const FILES = {
  'DFB_SANS_VAR_Italic.ttf': '03_DFB-Maenner-NM_Typografie/DFB_SANS_VAR_23/DFB_SANS_VAR/DFB_SANS_VAR_Italic.ttf',
};

export function ensureFonts() {
  mkdirSync(join(root, 'fonts'), { recursive: true });
  for (const [name, inZip] of Object.entries(FILES)) {
    const out = join(root, 'fonts', name);
    if (existsSync(out)) continue;
    if (!existsSync(ZIP)) throw new Error(`Missing ${out} and Archive.zip — put the font file into fonts/.`);
    writeFileSync(out, execFileSync('unzip', ['-p', ZIP, inZip], { maxBuffer: 64 << 20 }));
    console.log('extracted fonts/' + name);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) ensureFonts();
