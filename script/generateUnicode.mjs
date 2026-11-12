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
const asciiFastPaths = {
  varid_start: "  if ((uint32_t) c < 128) return (uint32_t) (c - 'a') < 26;\n",
  identifier_suffix: "  if ((uint32_t) c < 128) return (uint32_t) (c - '0') < 10 || (uint32_t) (c - 'A') < 26;\n",
  conid_start: "  if ((uint32_t) c < 128) return (uint32_t) (c - 'A') < 26;\n",
  space: "  if ((uint32_t) c < 128) return c == ' ';\n",
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
const header = `#include <stdbool.h>
#include <stdint.h>

typedef struct {
  int32_t first;
  int32_t last;
  const uint8_t *bits;
} UnicodeBlock;

static const UnicodeBlock *unicode_find_block(int32_t c, const UnicodeBlock *blocks, uint32_t count);
static const UnicodeBlock *unicode_bsearch_block(int32_t c, const UnicodeBlock *blocks, uint32_t count);

static bool unicode_contains(int32_t c, const UnicodeBlock *blocks, uint32_t count) {
  if (c < blocks[0].first) return false;
  const UnicodeBlock *block = c <= blocks[0].last ? &blocks[0] : unicode_find_block(c, blocks, count);
  if (!block) return false;
  uint32_t offset = (uint32_t) (c - block->first);
  return (block->bits[offset >> 3] & (1u << (offset & 7))) != 0;
}

static const UnicodeBlock *unicode_find_block(int32_t c, const UnicodeBlock *blocks, uint32_t count) {
  if (count > 4) return unicode_bsearch_block(c, blocks, count);
  for (uint32_t i = 1; i < count; i++) {
    if (c <= blocks[i].last) return c >= blocks[i].first ? &blocks[i] : 0;
  }
  return 0;
}

static const UnicodeBlock *unicode_bsearch_block(int32_t c, const UnicodeBlock *blocks, uint32_t count) {
  uint32_t low = 1;
  uint32_t high = count;
  while (low < high) {
    uint32_t mid = low + ((high - low) >> 1);
    if (c < blocks[mid].first) high = mid;
    else if (c > blocks[mid].last) low = mid + 1;
    else return &blocks[mid];
  }
  return 0;
}

${tables.join('\n')}
static bool is_identifier_char(int32_t c) {
  if ((uint32_t) c < 128) return (uint32_t) ((c | 32) - 'a') < 26 || (uint32_t) (c - '0') < 10;
  return is_varid_start_char(c) || is_identifier_suffix_char(c);
}
`;
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
  const fastPath = asciiFastPaths[name] ?? '';
  return `${arrays.join('\n')}\nstatic const UnicodeBlock ${name}_blocks[] = {\n${blocks}\n};\n\nstatic bool is_${name}_char(int32_t c) {\n${fastPath}  return unicode_contains(c, ${name}_blocks, sizeof(${name}_blocks) / sizeof(${name}_blocks[0]));\n}\n`;
}
