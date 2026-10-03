/**
 * Extract selected paths out of the DSH app.asar.
 *
 * Usage:
 *   node tools/asar-extract.cjs <outDir> <pathPrefix> [pathPrefix...]
 *
 * Example — pull the sidebar packages plus the slot system out of the app:
 *   node tools/asar-extract.cjs ./core \
 *     /dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/ \
 *     /dsh/node_modules/@deepseek-ai/dsh-client-ui-slots/ \
 *     /dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/
 *
 * Paths keep their archive layout under <outDir>, e.g.
 *   ./core/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js
 *
 * Set DSH_ASAR to override the archive path.
 */
const fs = require('fs');
const path = require('path');
const { readArchive, listFiles, DEFAULT_ARCHIVE } = require('./asar-reader.cjs');

const archive = process.env.DSH_ASAR || DEFAULT_ARCHIVE;
const outRoot = process.argv[2];
const prefixes = process.argv.slice(3);

if (!outRoot || prefixes.length === 0) {
  console.error('usage: node tools/asar-extract.cjs <outDir> <pathPrefix> [...]');
  process.exit(1);
}

const { header, dataOffset } = readArchive(archive);
const files = listFiles(header);
const fd = fs.openSync(archive, 'r');

let written = 0;
let unpacked = 0;
for (const file of files) {
  if (!prefixes.some((prefix) => file.path.startsWith(prefix))) continue;
  const dest = path.join(outRoot, file.path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (file.unpacked) {
    // Stored beside the archive rather than inside it.
    const source = path.join(`${archive}.unpacked`, file.path);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
      written += 1;
    } else {
      unpacked += 1;
    }
    continue;
  }
  const buf = Buffer.alloc(file.size);
  fs.readSync(fd, buf, 0, file.size, dataOffset + file.offset);
  fs.writeFileSync(dest, buf);
  written += 1;
}
console.log(`extracted ${written} files to ${outRoot}`);
if (unpacked > 0) console.log(`skipped ${unpacked} unpacked entries (missing on disk)`);
