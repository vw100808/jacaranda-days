#!/usr/bin/env node
/**
 * Build a standalone HTML file without external tooling.
 *
 * The modules are concatenated in dependency order, `export` keywords are
 * stripped and their imports are hoisted into one `import * as THREE`.
 * Three.js itself is embedded as a base64 blob and resolved through a runtime
 * import map. The result works directly from file:// with no server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const order = [
  'config.js',
  'utils.js',
  'materials.js',
  'architecture.js',
  'streetscape.js',
  'props.js',
  'trees.js',
  'lamp-local-lift.js',
  'petals.js',
  'lighting.js',
  'controls.js',
  'main.js',
];

let app = "import * as THREE from 'three';\n\n";
for (const file of order) {
  let text = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  text = text.replace(
    /import\s+[^;]*?from\s+['"][^'"]+['"];?/gs,
    '',
  );
  text = text.replace(
    /^export\s+(?=(?:const|let|var|function|class|async\s+function)\b)/gm,
    '',
  );
  app += `\n/* ------------------------------------------------------------------ */\n`;
  app += `/* ${file.padEnd(64)}*/\n`;
  app += `/* ------------------------------------------------------------------ */\n\n`;
  app += text.trim() + '\n';
  if (file === 'config.js') app += '\nconst B = BUILDING;\n';
}

// A quick parse check before embedding anything.
try {
  new Function(app.replace(/^import[^\n]+\n/, '')); // eslint-disable-line no-new-func
} catch (error) {
  // `import * as THREE` cannot be parsed by Function, so only report errors
  // if the stripped body is itself invalid.
  if (!/import|export/.test(String(error))) throw error;
}

const three = fs.readFileSync(
  path.join(root, 'vendor', 'three.module.min.js'),
);
const appBase64 = Buffer.from(app, 'utf8').toString('base64');
const threeBase64 = three.toString('base64');

const bootstrap = `
(() => {
  const threeBase64 = ${JSON.stringify(threeBase64)};
  const appBase64 = ${JSON.stringify(appBase64)};

  function decode(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function fail(error) {
    console.error(error);
    document.body.classList.add('has-error');
    const panel = document.querySelector('.fallback');
    if (panel) {
      panel.hidden = false;
      const copy = panel.querySelector('p');
      if (copy) copy.textContent = '场景模块未能启动。请检查浏览器控制台。';
    }
  }

  try {
    const threeUrl = URL.createObjectURL(new Blob([decode(threeBase64)], { type: 'text/javascript' }));
    const appUrl = URL.createObjectURL(new Blob([decode(appBase64)], { type: 'text/javascript' }));
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({ imports: { three: threeUrl } });
    document.head.appendChild(map);
    import(appUrl).catch(fail);
  } catch (error) {
    fail(error);
  }
})();
`;

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

html = html.replace(
  '    <link rel="stylesheet" href="./styles.css" />',
  `    <style>\n${css}\n    </style>`,
);
html = html.replace(
  /\n\s*<script type="importmap">[\s\S]*?<\/script>/,
  '',
);
html = html.replace(
  '    <script type="module" src="./src/main.js"></script>',
  `    <script>\n${bootstrap}\n    </script>`,
);
html = html.replace('</body>', `  </body>`);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'jacaranda-corner.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KiB)`);
