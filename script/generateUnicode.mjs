import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const sourceUrl =
  'https://raw.githubusercontent.com/tek/tree-sitter-haskell/d0b03ca15c611504ba8a94f0aaa0fa47cf65a05b/tools/UnicodeData.txt';
const sourceSha256 = '2fc713e6a31a87c4850a37fe2caffa4218180fadb5de86b43a143ddb4581fb86';
const categories = {
  varid_start: ['Ll', 'Lo'],
  identifier_suffix: ['Lm', 'Lt', 'Lu', 'Mn', 'Nd', 'Nl', 'No'],
  conid_start: ['Lu', 'Lt'],
  symop: ['Pc', 'Pd', 'Po', 'Sc', 'Sk', 'Sm', 'So'],
  space: ['Zs'],
};
const root = path.resolve(import.meta.dirname, '..');
const bytes = process.argv[2] ? await fs.readFile(process.argv[2]) : await readSource();
assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceSha256, 'Unexpected UnicodeData source');
const points = readCodepoints(bytes.toString('utf8'));
const tables = Object.entries(categories).map(([name, selected]) =>
  generateTable(
    name,
    points.filter((point) => selected.includes(point.category)).map((point) => point.value)
  )
);
const header = `#include <stdbool.h>\n#include <stdint.h>\n\ntypedef struct {\n  int32_t first;\n  int32_t last;\n  const uint8_t *bits;\n} UnicodeBlock;\n\nstatic bool unicode_contains(int32_t c, const UnicodeBlock *blocks, uint32_t count) {\n  for (uint32_t i = 0; i < count; i++) {\n    if (c < blocks[i].first) return false;\n    if (c <= blocks[i].last) {\n      uint32_t offset = c - blocks[i].first;\n      return (blocks[i].bits[offset >> 3] & (1u << (offset & 7))) != 0;\n    }\n  }\n  return false;\n}\n\n${tables.join('\n')}\nstatic bool is_identifier_char(int32_t c) {\n  return is_varid_start_char(c) || is_identifier_suffix_char(c);\n}\n`;
await fs.mkdir(path.join(root, '.tmp'), { recursive: true });
const workspace = await fs.mkdtemp(path.join(root, '.tmp/unicode-'));
try {
  const temporary = path.join(workspace, 'unicode.h');
  await fs.writeFile(temporary, header);
  await fs.rename(temporary, path.join(root, 'src/unicode.h'));
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}

async function readSource() {
  const response = await fetchSource();
  return Buffer.from(await response.arrayBuffer());
}

async function fetchSource() {
  const response = await fetch(sourceUrl);
  assert.ok(response.ok, `UnicodeData download failed: ${response.status}`);
  return response;
}

function readCodepoints(text) {
  const points = [];
  let first;
  for (const line of text.trimEnd().split('\n')) {
    const fields = line.split(';');
    assert.equal(fields.length, 15, `Invalid UnicodeData row: ${line}`);
    const value = Number.parseInt(fields[0], 16),
      name = fields[1],
      category = fields[2];
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 0x10_ff_ff);
    if (name.endsWith(', First>')) {
      assert.equal(first, undefined);
      first = { value, name, category };
    } else if (name.endsWith(', Last>')) {
      assert.ok(
        first &&
          first.category === category &&
          first.name.replace(', First>', '') === name.replace(', Last>', '') &&
          first.value <= value,
        'Unmatched UnicodeData range'
      );
      for (let c = first.value; c <= value; c++) points.push({ value: c, category });
      first = undefined;
    } else {
      assert.equal(first, undefined, 'Unclosed UnicodeData range');
      points.push({ value, category });
    }
  }
  assert.equal(first, undefined, 'Unclosed UnicodeData range');
  return points;
}

function generateTable(name, points) {
  const groups = [];
  for (const point of points) {
    const previous = groups.at(-1);
    if (!previous || point - previous.at(-1) > 1024) groups.push([point]);
    else previous.push(point);
  }
  const arrays = groups.map((group, index) => {
    const first = group[0],
      last = group.at(-1),
      bits = new Uint8Array(Math.ceil((last - first + 1) / 8));
    for (const point of group) bits[(point - first) >> 3] |= 1 << ((point - first) & 7);
    const rows = [];
    for (let start = 0; start < bits.length; start += 20)
      rows.push(
        '  ' +
          Array.from(bits.subarray(start, start + 20), (byte) => `0x${byte.toString(16).padStart(2, '0')}`).join(', ') +
          ','
      );
    return `static const uint8_t ${name}_${index}[] = {\n${rows.join('\n')}\n};\n`;
  });
  const blocks = groups.map((group, index) => `  {${group[0]}, ${group.at(-1)}, ${name}_${index}},`).join('\n');
  return `${arrays.join('\n')}\nstatic const UnicodeBlock ${name}_blocks[] = {\n${blocks}\n};\n\nstatic bool is_${name}_char(int32_t c) {\n  return unicode_contains(c, ${name}_blocks, sizeof(${name}_blocks) / sizeof(${name}_blocks[0]));\n}\n`;
}
