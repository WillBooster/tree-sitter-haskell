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
        ])
      );
      expect(
        tags.filter(({ role, name }) => role === 'def' && ['value', 'left', 'right', 'a', 'Int'].includes(name))
      ).toHaveLength(0);
      expect(tags.filter(({ role, kind }) => role === 'ref' && kind === 'call')).toHaveLength(7);
      expect(
        tags.filter(({ kind }) => kind === 'function' || kind === 'method').some(({ name }) => name === '->')
      ).toBe(false);
    },
  }
);
