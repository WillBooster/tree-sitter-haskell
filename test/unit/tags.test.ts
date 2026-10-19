import fs from 'node:fs';
import path from 'node:path';
import { afterAll, expect } from 'vitest';
import { testCommand } from './run.js';

interface Tag {
  name: string;
  kind: string;
  role: string;
  row: number;
  column: number;
}

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
fs.mkdirSync(path.join(repositoryRoot, '.tmp'), { recursive: true });
const workspace = fs.mkdtempSync(path.join(repositoryRoot, '.tmp/navigation-'));
const configPath = path.join(workspace, 'config.json');
fs.symlinkSync(repositoryRoot, path.join(workspace, 'tree-sitter-haskell'), 'dir');
fs.writeFileSync(configPath, JSON.stringify({ 'parser-directories': [workspace] }));
afterAll(() => fs.rmSync(workspace, { recursive: true, force: true }));

testCommand(
  'indexes named declarations and calls without treating type arrows or function parameters as declarations',
  [
    'script/tree-sitter',
    'tags',
    '--config-path',
    configPath,
    '--scope',
    'source.haskell',
    'test/fixtures/navigation/declarations.hs',
  ],
  170_000,
  {
    check: (output) => {
      expect(output).not.toContain('You should add a `tags` entry');
      const tags = readTags(output);
      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'Demo.Navigation', kind: 'module', role: 'def', row: 1, column: 7 },
          { name: 'convert', kind: 'function', role: 'def', row: 4, column: 0 },
          { name: 'first', kind: 'function', role: 'def', row: 7, column: 0 },
          { name: 'second', kind: 'function', role: 'def', row: 7, column: 7 },
          { name: 'first', kind: 'variable', role: 'def', row: 8, column: 0 },
          { name: 'Box', kind: 'class', role: 'def', row: 12, column: 5 },
          { name: 'Wrapped', kind: 'class', role: 'def', row: 13, column: 8 },
          { name: 'Alias', kind: 'class', role: 'def', row: 14, column: 5 },
          { name: 'Printable', kind: 'interface', role: 'def', row: 17, column: 6 },
          { name: 'render', kind: 'method', role: 'def', row: 19, column: 2 },
          { name: 'render', kind: 'method', role: 'def', row: 23, column: 2 },
          { name: 'Printable', kind: 'implementation', role: 'ref', row: 22, column: 9 },
          { name: '<+>', kind: 'function', role: 'def', row: 25, column: 1 },
          { name: 'combine', kind: 'function', role: 'def', row: 26, column: 6 },
          { name: 'convert', kind: 'call', role: 'ref', row: 29, column: 23 },
          { name: '<+>', kind: 'call', role: 'ref', row: 30, column: 27 },
          { name: '<+>', kind: 'call', role: 'ref', row: 32, column: 35 },
          { name: 'combine', kind: 'call', role: 'ref', row: 33, column: 42 },
          { name: 'Family', kind: 'class', role: 'def', row: 35, column: 12 },
          { name: 'Assoc', kind: 'class', role: 'def', row: 37, column: 7 },
          { name: 'external', kind: 'function', role: 'def', row: 38, column: 32 },
          { name: ':+:', kind: 'class', role: 'def', row: 40, column: 7 },
          { name: ':*:', kind: 'class', role: 'def', row: 41, column: 10 },
          { name: ':/:', kind: 'class', role: 'def', row: 42, column: 7 },
          { name: ':?:', kind: 'class', role: 'def', row: 43, column: 14 },
          { name: ':!:', kind: 'class', role: 'def', row: 44, column: 14 },
          { name: ':<:', kind: 'interface', role: 'def', row: 45, column: 8 },
          { name: ':<:', kind: 'implementation', role: 'ref', row: 47, column: 13 },
          { name: 'Related', kind: 'interface', role: 'def', row: 49, column: 9 },
          { name: 'Related', kind: 'implementation', role: 'ref', row: 50, column: 14 },
          { name: 'single', kind: 'method', role: 'def', row: 53, column: 10 },
          { name: 'pair', kind: 'method', role: 'def', row: 54, column: 10 },
          { name: 'other', kind: 'method', role: 'def', row: 54, column: 16 },
          { name: 'pair', kind: 'method', role: 'def', row: 57, column: 2 },
          { name: 'other', kind: 'method', role: 'def', row: 57, column: 8 },
          { name: 'Show', kind: 'implementation', role: 'ref', row: 60, column: 18 },
          { name: ':<:', kind: 'implementation', role: 'ref', row: 61, column: 22 },
          { name: 'Related', kind: 'implementation', role: 'ref', row: 62, column: 23 },
          { name: 'InfixUse', kind: 'class', role: 'def', row: 64, column: 5 },
          { name: ':%:', kind: 'class', role: 'def', row: 65, column: 7 },
          { name: 'convert', kind: 'call', role: 'ref', row: 72, column: 23 },
          { name: 'convert', kind: 'call', role: 'ref', row: 73, column: 37 },
          { name: '<+>', kind: 'call', role: 'ref', row: 74, column: 37 },
          { name: '<+>', kind: 'call', role: 'ref', row: 75, column: 51 },
          { name: 'KData', kind: 'class', role: 'def', row: 79, column: 5 },
          { name: 'KNewtype', kind: 'class', role: 'def', row: 80, column: 8 },
          { name: 'KType', kind: 'class', role: 'def', row: 81, column: 12 },
          { name: 'KFamily', kind: 'class', role: 'def', row: 82, column: 12 },
          { name: ':&:', kind: 'class', role: 'def', row: 83, column: 7 },
          { name: ':^:', kind: 'class', role: 'def', row: 84, column: 15 },
          { name: ':~:', kind: 'class', role: 'def', row: 85, column: 18 },
          { name: ':$:', kind: 'class', role: 'def', row: 86, column: 6 },
          { name: ':=:', kind: 'interface', role: 'def', row: 87, column: 7 },
          { name: ':=:', kind: 'implementation', role: 'ref', row: 88, column: 10 },
          { name: 'Printable', kind: 'implementation', role: 'ref', row: 89, column: 14 },
          { name: 'Printable', kind: 'implementation', role: 'ref', row: 90, column: 23 },
          { name: ':%>', kind: 'class', role: 'def', row: 91, column: 9 },
          { name: '%%', kind: 'class', role: 'def', row: 92, column: 6 },
          { name: '>>>', kind: 'class', role: 'def', row: 93, column: 13 },
          { name: ':#:', kind: 'class', role: 'def', row: 94, column: 13 },
          { name: ':?>', kind: 'class', role: 'def', row: 96, column: 28 },
          { name: ':*>', kind: 'class', role: 'def', row: 97, column: 28 },
          { name: ':&>', kind: 'class', role: 'def', row: 98, column: 21 },
          { name: ':^>', kind: 'class', role: 'def', row: 99, column: 40 },
          { name: ':~>', kind: 'class', role: 'def', row: 100, column: 43 },
          { name: ':+>', kind: 'class', role: 'def', row: 102, column: 23 },
          { name: ':->', kind: 'class', role: 'def', row: 103, column: 23 },
          { name: ':$>', kind: 'class', role: 'def', row: 104, column: 26 },
          { name: ':%>', kind: 'class', role: 'def', row: 105, column: 46 },
          { name: ':!>', kind: 'class', role: 'def', row: 109, column: 4 },
        ])
      );
      expect(
        tags.filter(({ role, name }) => role === 'def' && ['value', 'left', 'right', 'a', 'Int'].includes(name))
      ).toHaveLength(0);
      expect(tags.filter(({ role, kind }) => role === 'ref' && kind === 'call')).toHaveLength(13);
      expect(
        tags.filter(({ role, kind, row }) => role === 'def' && kind === 'class' && row >= 64 && row <= 70)
      ).toHaveLength(2);
      expect(tags.filter(({ role, row }) => role === 'ref' && row >= 76 && row <= 77)).toHaveLength(0);
      expect(tags.filter(({ role, row }) => role === 'def' && row >= 79 && row <= 85)).toHaveLength(7);
      expect(tags.filter(({ role, kind, row }) => role === 'def' && kind === 'class' && row >= 96)).toHaveLength(10);
      expect(
        tags.filter(({ kind }) => kind === 'function' || kind === 'method').some(({ name }) => name === '->')
      ).toBe(false);
    },
  }
);

testCommand(
  'retains declaration roles and applied names through nested parentheses',
  [
    'script/tree-sitter',
    'tags',
    '--config-path',
    configPath,
    '--scope',
    'source.haskell',
    'test/fixtures/navigation/parentheses.hs',
  ],
  170_000,
  {
    check: (output) => {
      expect(output).not.toContain('You should add a `tags` entry');
      const tags = readTags(output);
      expect(tags).toEqual(
        expect.arrayContaining([
          { name: 'f', kind: 'function', role: 'def', row: 1, column: 1 },
          { name: 'g', kind: 'function', role: 'def', row: 2, column: 2 },
          { name: 'deep', kind: 'function', role: 'def', row: 3, column: 5 },
          { name: 'method', kind: 'method', role: 'def', row: 5, column: 3 },
          { name: 'method', kind: 'method', role: 'def', row: 7, column: 4 },
          { name: 'Box', kind: 'class', role: 'def', row: 8, column: 7 },
          { name: 'Alias', kind: 'class', role: 'def', row: 9, column: 7 },
          { name: 'Related', kind: 'interface', role: 'def', row: 10, column: 8 },
          { name: 'Related', kind: 'implementation', role: 'ref', row: 11, column: 11 },
          { name: 'f', kind: 'call', role: 'ref', row: 12, column: 17 },
          { name: 'f', kind: 'call', role: 'ref', row: 13, column: 26 },
          { name: '<+>', kind: 'call', role: 'ref', row: 14, column: 22 },
          { name: '<+>', kind: 'call', role: 'ref', row: 15, column: 36 },
          { name: '<+>', kind: 'function', role: 'def', row: 19, column: 7 },
          { name: 'combine', kind: 'function', role: 'def', row: 20, column: 8 },
          { name: '<~>', kind: 'method', role: 'def', row: 22, column: 9 },
          { name: 'methodInfix', kind: 'method', role: 'def', row: 24, column: 10 },
          { name: ':+:', kind: 'class', role: 'def', row: 25, column: 9 },
          { name: 'Wrap', kind: 'class', role: 'def', row: 26, column: 10 },
          { name: ':/:', kind: 'class', role: 'def', row: 27, column: 9 },
          { name: 'Family', kind: 'class', role: 'def', row: 28, column: 14 },
          { name: 'DataFamily', kind: 'class', role: 'def', row: 29, column: 14 },
          { name: ':<:', kind: 'interface', role: 'def', row: 30, column: 10 },
          { name: ':<:', kind: 'implementation', role: 'ref', row: 31, column: 15 },
          { name: 'Related', kind: 'implementation', role: 'ref', row: 32, column: 20 },
          { name: 'following', kind: 'variable', role: 'def', row: 39, column: 0 },
          { name: 'Kinded', kind: 'implementation', role: 'ref', row: 40, column: 11 },
          { name: 'Related', kind: 'implementation', role: 'ref', row: 41, column: 20 },
        ])
      );
      expect(tags.filter(({ kind }) => kind === 'call')).toHaveLength(4);
      expect(tags.filter(({ row }) => row >= 40)).toHaveLength(2);
      expect(tags.filter(({ kind, row }) => kind === 'function' && [5, 7, 22, 24].includes(row))).toHaveLength(0);
      expect(
        tags.filter(({ name }) =>
          ['hidden', 'argument', 'extra', 'first', 'second', 'bound', 'a', 'b', 'c'].includes(name)
        )
      ).toHaveLength(0);
    },
  }
);

function readTags(output: string): Tag[] {
  return [...output.matchAll(/^(.+?)\s+\|\s+(\S+)\s+(def|ref)\s+\((\d+), (\d+)\)/gm)].map(
    ([, name, kind, role, row, column]) => ({
      name: name!.trim(),
      kind: kind!,
      role: role!,
      row: Number(row),
      column: Number(column),
    })
  );
}
