import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const Root = path.join(import.meta.dirname, '../..');
await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(currentWasmPath(Root)));

// Consumers parse files while they are being edited, when many lines do not parse, so error recovery must stay linear:
// ten times the lines take about ten times as long, against a hundred times for a quadratic cost. The ratio catches a
// cost that grows faster than the input even on a slow CI runner. The parses are timed in the CPU time of the thread
// that runs them: wall-clock time is inflated unevenly by the test files running alongside, and the process's CPU time
// also counts the engine's background threads, which compile the Wasm build and collect garbage during the parses.
// 2,000 and 20,000 lines are measured after warm-up parses and in alternation, each keeping its fastest run; 18 leaves
// a margin over the expected ratio of 10 while failing for growth faster than about n^1.25.
test('parses a file with an error on each line in linear time', { timeout: 60_000 }, () => {
  const line = '= a\n';
  const small = line.repeat(2000);
  const large = line.repeat(20_000);
  parseCpuTime(large);
  parseCpuTime(large);
  let smallFastest = Infinity;
  let largeFastest = Infinity;
  for (let run = 0; run < 5; run++) {
    smallFastest = Math.min(smallFastest, parseCpuTime(small));
    largeFastest = Math.min(largeFastest, parseCpuTime(large));
  }
  expect(largeFastest / smallFastest).toBeLessThan(18);
});

test.each([' + ', ' {- c -} '])(
  'parses a long line separated by %j in linear time',
  { timeout: 60_000 },
  (separator) => {
    const source = (size: number): string =>
      `f = [ ${Array.from({ length: size }, (_, index) => `a${index}`).join(separator)} ]\n`;
    const small = source(1000);
    const large = source(4000);
    const tree = parser.parse(large)!;
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('variable')).toHaveLength(4001);
    tree.delete();
    parseCpuTime(large, false);
    let smallFastest = Infinity;
    let largeFastest = Infinity;
    for (let run = 0; run < 5; run++) {
      smallFastest = Math.min(smallFastest, parseCpuTime(small, false));
      largeFastest = Math.min(largeFastest, parseCpuTime(large, false));
    }
    expect(largeFastest / smallFastest).toBeLessThan(9);
  }
);

test('parses repeated unterminated macro-call comments in linear time', { timeout: 60_000 }, () => {
  const prefix = '#define import(x) x\nvalue=1\n';
  const small = prefix + 'import /* a\n'.repeat(500);
  const large = prefix + 'import /* a\n'.repeat(2000);
  parseCpuTime(large);
  let smallFastest = Infinity;
  let largeFastest = Infinity;
  for (let run = 0; run < 5; run++) {
    smallFastest = Math.min(smallFastest, parseCpuTime(small));
    largeFastest = Math.min(largeFastest, parseCpuTime(large));
  }
  expect(largeFastest / smallFastest).toBeLessThan(9);
});

function parseCpuTime(source: string, expectedError = true): number {
  const start = process.threadCpuUsage();
  const tree = parser.parse(source);
  const { system, user } = process.threadCpuUsage(start);
  if (!tree) throw new Error('The parser returned no tree');
  const { hasError } = tree.rootNode;
  tree.delete();
  expect(hasError).toBe(expectedError);
  return system + user;
}
