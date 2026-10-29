// Builds two self-contained pages (engine + fontkit + font inlined):
//   dist/index.html  — web tool, opens straight from disk
//   figma/ui.html    — Figma plugin UI
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// `import b64 from 'font:NAME'` → the font file from fonts/ as base64.
const fontPlugin = {
  name: 'font',
  setup(b) {
    b.onResolve({ filter: /^font:/ }, (a) => ({ path: join(root, 'fonts', a.path.slice(5)), namespace: 'font' }));
    b.onLoad({ filter: /.*/, namespace: 'font' }, (a) => ({
      contents: `export default ${JSON.stringify(readFileSync(a.path).toString('base64'))};`,
      loader: 'js',
    }));
  },
};

async function bundle(entry) {
  const r = await build({
    entryPoints: [join(root, entry)],
    bundle: true, format: 'iife', platform: 'browser', target: 'es2020',
    minify: true, write: false, legalComments: 'none',
    plugins: [fontPlugin],
  });
  return r.outputFiles[0].text;
}

const shell = readFileSync(join(root, 'src/ui/shell.html'), 'utf8');
const page = (js) => shell.replace('<script>/*__APP__*/</script>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);

// claude.ai artifact: the host wraps the page in its own <html>/<head>/<body>,
// so publish only title, metas, style and body content.
const artifactPage = (html) => {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>\s*/g, '');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  return head.trim() + '\n' + body.trim() + '\n';
};

mkdirSync(join(root, 'dist'), { recursive: true });
const web = page(await bundle('src/hosts/web.js'));
writeFileSync(join(root, 'dist/index.html'), web);
writeFileSync(join(root, 'dist/artifact.html'), artifactPage(web));
writeFileSync(join(root, 'figma/ui.html'), page(await bundle('src/hosts/figma-ui.js')));
console.log('built dist/index.html and figma/ui.html');
