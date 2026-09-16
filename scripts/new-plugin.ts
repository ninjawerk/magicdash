/** Usage: npm run new-plugin my-plugin "My Plugin" */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const [, , idArg, nameArg] = process.argv;
if (!idArg || !/^[a-z0-9][a-z0-9-]*$/.test(idArg)) {
  console.error('Usage: npm run new-plugin <kebab-case-id> ["Display name"]');
  process.exit(1);
}
const id = idArg;
const name = nameArg ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const src = path.resolve('plugins/_template');
const dest = path.resolve('plugins', id);

try {
  await fs.access(dest);
  console.error(`plugins/${id} already exists`);
  process.exit(1);
} catch {
  /* good */
}

await fs.mkdir(dest);
for (const f of await fs.readdir(src)) {
  let content = await fs.readFile(path.join(src, f), 'utf8');
  content = content.replace(/id: '_template'/, `id: '${id}'`).replace(/name: 'My plugin'/, `name: '${name}'`);
  await fs.writeFile(path.join(dest, f), content);
}
console.log(`Created plugins/${id}/ (manifest.ts, client.tsx, server.ts).\nRestart \`npm run dev\` to load it, then add it from Edit → Add.`);
