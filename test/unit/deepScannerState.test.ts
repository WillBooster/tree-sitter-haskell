import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
const depths = [125, 126, 127, 128, 256, 1024];
const languages = ['haskell', 'hsc'] as const;
const examples = [
  ...depths.map((depth) => ({ label: `constructor pattern ${depth}`, source: patternSource(depth) })),
  ...[128, 256].flatMap((depth) => [
    { label: `implicit layouts ${depth}`, source: layoutSource(depth) },
    { label: `alternating braces and parentheses ${depth}`, source: bracedSource(depth) },
  ]),
  ...[384, 512, 1024].map((depth) => ({
    label: `alternating braces and parentheses ${depth}`,
    source: bracedSource(depth),
  })),
];

await Parser.init();
const grammars = await Promise.all(
  languages.map(async (name) => ({ name, language: await Language.load(currentWasmPath(root, name)) }))
);

test.each(grammars.flatMap((grammar) => examples.map((example) => ({ ...example, ...grammar }))))(
  'preserves $name $label and later declarations in Wasm',
  ({ label, source, language }) => {
    const parser = new Parser().setLanguage(language);
    try {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, label).toBe(false);
        const following = tree.rootNode.childForFieldName('declarations')?.lastNamedChild;
        const followingRow = source.split('\n').length - 2;
        expect([following?.text, following?.startPosition, following?.endPosition]).toEqual([
          'following = 1',
          { row: followingRow, column: 0 },
          { row: followingRow, column: 13 },
        ]);
      } finally {
        tree.delete();
      }
      const deeper = parser.parse(source.replace('deep', `${'Box ('.repeat(4)}deeper${')'.repeat(4)}`))!;
      try {
        expect(deeper.rootNode.hasError, `${label}, deeper`).toBe(false);
      } finally {
        deeper.delete();
      }
    } finally {
      parser.delete();
    }
  },
  30_000
);

test.each(languages.flatMap((name) => [false, true].map((debug) => ({ name, debug }))))(
  'preserves deep $name patterns and following-name ranges in native builds with debug=$debug',
  ({ name, debug }) => {
    const workspace = fs.mkdtempSync(path.join(root, '.tmp/deep-scanner-'));
    try {
      const input = path.join(workspace, 'input.hs');
      const output = path.join(workspace, 'output.txt');
      const config = path.join(workspace, 'config.json');
      fs.writeFileSync(config, '{}');
      const library = path.join(workspace, `${name}-${debug ? 'debug' : 'optimized'}.dylib`);
      run(['build', ...(debug ? ['-0'] : []), '-o', library, name === 'hsc' ? 'hsc' : '.'], output);
      for (const { label, source } of examples) {
        fs.writeFileSync(input, source);
        const tail = run(['parse', '--config-path', config, '--lib-path', library, '--lang-name', name, input], output);
        const row = source.split('\n').length - 2;
        expect(tail, `${name} ${label}, debug ${debug}`).toContain(
          `    (bind [${row}, 0] - [${row}, 13]\n      name: (variable [${row}, 0] - [${row}, 9])`
        );
      }
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  },
  300_000
);

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

function run(arguments_: string[], outputPath: string): string {
  const fd = fs.openSync(outputPath, 'w');
  let result;
  try {
    result = spawnSync('script/tree-sitter', arguments_, {
      cwd: root,
      timeout: 120_000,
      stdio: ['ignore', fd, 'ignore'],
    });
  } finally {
    fs.closeSync(fd);
  }
  const size = fs.statSync(outputPath).size;
  const length = Math.min(size, 4096);
  const buffer = Buffer.alloc(length);
  const readFd = fs.openSync(outputPath, 'r');
  try {
    fs.readSync(readFd, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(readFd);
  }
  const tail = buffer.toString('utf8');
  expect(result.error, arguments_.join(' ')).toBeUndefined();
  expect(result.status, `${arguments_.join(' ')}\n${tail}`).toBe(0);
  return tail;
}
