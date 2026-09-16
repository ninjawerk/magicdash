/** Usage: npm run pack-plugin <id>   → writes <id>-<version>.zip in the project root, ready to share / upload. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run pack-plugin <plugin-id>');
  process.exit(1);
}
const dir = path.resolve('plugins', id);
try {
  await fs.access(path.join(dir, 'manifest.ts'));
} catch {
  console.error(`plugins/${id}/manifest.ts not found`);
  process.exit(1);
}
const manifest = await fs.readFile(path.join(dir, 'manifest.ts'), 'utf8');
const version = manifest.match(/\bversion\s*:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? '0.0.0';
const zip = new AdmZip();
zip.addLocalFolder(dir, id, (p) => !p.includes('node_modules') && !path.basename(p).startsWith('.'));
const out = path.resolve(`${id}-${version}.zip`);
zip.writeZip(out);
console.log(`Packed plugins/${id} → ${path.basename(out)}\nInstall it on another dashboard via Edit → Add → Install a plugin…`);
