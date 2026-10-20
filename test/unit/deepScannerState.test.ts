import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, type Node } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
const depths = [125, 126, 127, 128, 256, 1024];
const examples = [
  ...depths.map((depth) => ({ label: `constructor pattern ${depth}`, source: patternSource(depth) })),
  ...[128, 256].flatMap((depth) => [
    { label: `implicit layouts ${depth}`, source: layoutSource(depth) },
    { label: `alternating braces and parentheses ${depth}`, source: bracedSource(depth) },
  ]),
];

await Parser.init();
const language = await Language.load(currentWasmPath(root));

test('preserves deep constructor patterns and later declarations through Wasm edits and undo', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const { label, source: initialSource } of examples) {
      let source = initialSource;
      let tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, label).toBe(false);
        const following = tree.rootNode.childForFieldName('declarations')?.lastNamedChild;
        const followingRow = source.split('\n').length - 2;
        expect([following?.text, following?.startPosition, following?.endPosition]).toEqual([
          'following = 1',
          { row: followingRow, column: 0 },
          { row: followingRow, column: 13 },
        ]);
        const original = snapshot(tree.rootNode);
        const startIndex = source.indexOf('deep');
        const row = source.slice(0, startIndex).split('\n').length - 1;
        const column = startIndex - source.lastIndexOf('\n', startIndex - 1) - 1;
        let previous = 'deep';
        for (const replacement of [`${'Box ('.repeat(4)}deeper${')'.repeat(4)}`, 'deep']) {
          const oldEndIndex = startIndex + previous.length;
          tree.edit(
            new Edit({
              startIndex,
              oldEndIndex,
              newEndIndex: startIndex + replacement.length,
              startPosition: { row, column },
              oldEndPosition: { row, column: column + previous.length },
              newEndPosition: { row, column: column + replacement.length },
            })
          );
          source = source.slice(0, startIndex) + replacement + source.slice(oldEndIndex);
          previous = replacement;
          const incremental = parser.parse(source, tree)!;
          tree.delete();
          tree = incremental;
          const fresh = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError, `${label}, ${replacement}`).toBe(false);
            expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
          } finally {
            fresh.delete();
          }
        }
        expect(snapshot(tree.rootNode)).toEqual(original);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('preserves deep patterns and following-name ranges in optimized and debug native builds', () => {
  const workspace = fs.mkdtempSync(path.join(root, '.tmp/deep-scanner-'));
  try {
    const input = path.join(workspace, 'input.hs');
    const query = path.join(workspace, 'names.scm');
    fs.writeFileSync(query, '(declarations (bind name: (variable) @name))');
    for (const debug of [false, true]) {
      const library = path.join(workspace, debug ? 'debug.dylib' : 'optimized.dylib');
      run(['build', ...(debug ? ['-0'] : []), '-o', library]);
      for (const { label, source } of examples) {
        fs.writeFileSync(input, source);
        const arguments_ = ['--lib-path', library, '--lang-name', 'haskell'];
        run(['parse', ...arguments_, '--quiet', input]);
        const output = run(['query', ...arguments_, query, input]);
        const row = source.split('\n').length - 2;
        expect(output, `${label}, debug ${debug}`).toContain(
          `capture: 0 - name, start: (${row}, 0), end: (${row}, 9), text: \`following\``
        );
      }
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}, 300_000);

function patternSource(depth: number): string {
  return `(${'Box ('.repeat(depth)}deep${')'.repeat(depth)}) = value\nfollowing = 1\n`;
}

function layoutSource(depth: number): string {
  return (
    'value =\n' +
    Array.from({ length: depth }, (_, index) => `${' '.repeat(index * 8 + 2)}let x =\n`).join('') +
    `${' '.repeat(depth * 8 + 2)}deep\n` +
    Array.from({ length: depth }, (_, index) => `${' '.repeat((depth - index - 1) * 8 + 2)}in x\n`).join('') +
    'following = 1\n'
  );
}

function bracedSource(depth: number): string {
  return `value = (${'let { x = ('.repeat(depth)}deep${') } in x'.repeat(depth)})\nfollowing = 1\n`;
}

function snapshot(rootNode: Node): unknown[] {
  const pending = [rootNode];
  const nodes = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push([node.type, node.startIndex, node.endIndex, node.startPosition, node.endPosition, node.isNamed]);
    pending.push(...node.children.toReversed());
  }
  return nodes;
}

function run(arguments_: string[]): string {
  const result = spawnSync('script/tree-sitter', arguments_, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 16 * 1024 * 1024,
  });
  expect(result.error, arguments_.join(' ')).toBeUndefined();
  expect(result.status, arguments_.join(' ') + result.stdout).toBe(0);
  return result.stdout;
}
