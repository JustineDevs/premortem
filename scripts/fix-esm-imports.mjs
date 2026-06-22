import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targetDir = process.argv[2] ?? 'dist';
const distRoot = resolve(process.cwd(), targetDir);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !fullPath.endsWith('.js')) {
      continue;
    }

    const source = await readFile(fullPath, 'utf8');
    const patched = source
      .replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (_match, prefix, specifier, suffix) => {
        if (specifier.endsWith('.js') || specifier.endsWith('.mjs') || specifier.endsWith('.cjs')) {
          return `${prefix}${specifier}${suffix}`;
        }
        return `${prefix}${specifier}.js${suffix}`;
      })
      .replace(
        /(export\s+\*\s+from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g,
        (_match, prefix, specifier, suffix) => {
          if (specifier.endsWith('.js') || specifier.endsWith('.mjs') || specifier.endsWith('.cjs')) {
            return `${prefix}${specifier}${suffix}`;
          }
          return `${prefix}${specifier}.js${suffix}`;
        }
      );

    if (patched !== source) {
      await writeFile(fullPath, patched);
    }
  }
}

await stat(distRoot);
await walk(distRoot);
