/**
 * Index every file inside the DSH app.asar.
 *
 * Usage:
 *   node tools/asar-list.cjs [app.asar] [out.txt]
 *
 * Output: tab-separated `path<TAB>size<TAB>offset`, default ./all-files.txt.
 * Run this first if you plan to use grep to find a package, then feed paths
 * to tools/asar-extract.cjs.
 */
const fs = require('fs');
const path = require('path');
const { readArchive, listFiles, DEFAULT_ARCHIVE } = require('./asar-reader.cjs');

const archive = process.argv[2] || DEFAULT_ARCHIVE;
const out = process.argv[3] || path.join(process.cwd(), 'all-files.txt');

const { header, dataOffset } = readArchive(archive);
const files = listFiles(header);
fs.writeFileSync(
  out,
  files
    .map((f) => [f.path, f.size, f.unpacked ? 'unpacked' : f.offset].join('\t'))
    .join('\n'),
);
console.log(`files: ${files.length}`);
console.log(`data offset: ${dataOffset}`);
console.log(`written: ${out}`);
