/**
 * Minimal Electron/asar reader for the DSH desktop app.
 *
 * The DSH core packages ship inside `app.asar`, a single file rather than a
 * directory. This module parses its header so the sibling tools can list and
 * extract individual files without any external dependency.
 *
 * Layout:
 *   [0..3]   uint32 = 4 (pickle payload size of the next field)
 *   [4..7]   uint32 = header pickle size
 *   [8..11]  uint32 = JSON header string length
 *   [12..15] padding
 *   [16..]   JSON header
 *   file data begins at 8 + headerSize; each entry's `offset` is relative to it.
 */
const fs = require('fs');

function readArchive(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(4);
  const strLen = head.readUInt32LE(12);
  const buf = Buffer.alloc(strLen);
  fs.readSync(fd, buf, 0, strLen, 16);
  return {
    header: JSON.parse(buf.toString('utf8')),
    dataOffset: 8 + headerSize,
    fd,
  };
}

/**
 * Flatten the header tree into [{ path, size, offset, unpacked }, ...].
 *
 * `unpacked: true` entries have no `offset`: Electron stores them on disk under
 * `<archive>.unpacked/<path>` (native modules and other binaries), so callers
 * must read them from there instead of seeking inside the archive.
 */
function listFiles(header) {
  const out = [];
  (function walk(node, prefix) {
    for (const [name, value] of Object.entries(node.files || {})) {
      const path = prefix + '/' + name;
      if (value.files) walk(value, path);
      else {
        out.push({
          path,
          size: value.size,
          offset: value.offset === undefined ? undefined : Number(value.offset),
          unpacked: value.unpacked === true,
        });
      }
    }
  })(header, '');
  return out;
}

const DEFAULT_ARCHIVE =
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar';

module.exports = { readArchive, listFiles, DEFAULT_ARCHIVE };
