import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const build = resolve('dist');
const destination = resolve(process.argv[2] ?? 'dist/oyun.html');
const read = (file, base = build) => readFileSync(resolve(base, file), 'utf8');
const embed = (file, mediaType, base = build) => {
  const data = readFileSync(resolve(base, file)).toString('base64');
  return `data:${mediaType};base64,${data}`;
};

let html = read('index.html');
const scriptPattern = /<script type="module" [^>]*src="([^"]+)"[^>]*><\/script>/;
const stylePattern = /<link rel="stylesheet" [^>]*href="([^"]+)"[^>]*>/;
const script = html.match(scriptPattern);
const style = html.match(stylePattern);
if (!script || !style) throw new Error('Run npm run build before bundling the standalone file.');

const artworkPath = './question-studio.webp';
const javascript = read(script[1]);
if (!javascript.includes(artworkPath)) throw new Error('The built game is missing its artwork reference.');

const inlineScript = javascript.replaceAll(artworkPath, embed(artworkPath, 'image/webp'));
const styleDirectory = dirname(resolve(build, style[1]));
const inlineStyle = read(style[1]).replace(/url\((\.\/[^)]+\.woff2)\)/g, (_, file) => {
  return `url(${embed(file, 'font/woff2', styleDirectory)})`;
});
const licenses = ['Inter.txt', 'Bricolage-Grotesque.txt']
  .map(file => read(`font-licenses/${file}`).trim())
  .join('\n\n');

html = html
  .replace(scriptPattern, () => `<script type="module">${inlineScript}</script>`)
  .replace(stylePattern, () => `<style>${inlineStyle}</style>`)
  .replace('</head>', () => `  <!-- Embedded font licenses\n${licenses}\n  -->\n  </head>`);
writeFileSync(destination, html);
console.log(destination);
