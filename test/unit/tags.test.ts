import fs from 'node:fs';
import path from 'node:path';
import { afterAll, expect } from 'vitest';
import { testCommand } from './run.js';

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
      const tags = [...output.matchAll(/^(.+?)\s+\|\s+(\S+)\s+(def|ref)\s+\((\d+), (\d+)\)/gm)].map(
        ([, name, kind, role, row, column]) => ({
          name: name!.trim(),
          kind,
          role,
          row: Number(row),
          column: Number(column),
        })
      );
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
        ])
      );
      expect(
        tags.filter(({ role, name }) => role === 'def' && ['value', 'left', 'right', 'a', 'Int'].includes(name))
      ).toHaveLength(0);
      expect(tags.filter(({ role, kind }) => role === 'ref' && kind === 'call')).toHaveLength(13);
      expect(tags.filter(({ role, kind, row }) => role === 'def' && kind === 'class' && row >= 64)).toHaveLength(2);
      expect(tags.filter(({ role, row }) => role === 'ref' && row >= 76)).toHaveLength(0);
      expect(
        tags.filter(({ kind }) => kind === 'function' || kind === 'method').some(({ name }) => name === '->')
      ).toBe(false);
    },
  }
);
