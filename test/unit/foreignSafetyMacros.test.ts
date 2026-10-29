import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));
const queries = fs
  .readdirSync(path.join(root, 'queries'))
  .filter((file) => file.endsWith('.scm'))
  .map((file) => new Query(language, fs.readFileSync(path.join(root, 'queries', file), 'utf8')));
afterAll(() => {
  for (const query of queries) query.delete();
});

test('retains calling convention and safety macro fields without consuming optional fields or following declarations', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/foreignSafetyMacros.hs'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const imports = tree.rootNode.descendantsOfType('foreign_import');
    expect(
      imports.map((node) => [
        node.childForFieldName('calling_convention')?.text,
        node.childForFieldName('safety')?.text,
        node.childForFieldName('entity')?.text,
        node.childForFieldName('signature')?.childForFieldName('name')?.text,
      ])
    ).toEqual([
      ['CALLCONV', 'SAFE_ON_WIN', '"sin"', 'c_sin'],
      ['CALL64', 'SAFE64', '"cos"', 'c_cos'],
      ['ccall', 'SAFE64', undefined, 'c_tan'],
      ['CALL64', undefined, '"atan"', 'c_atan'],
      ['CALL64suffix', 'SAFE64suffix', '"sin"', 'c_mixed'],
      ['ccall', undefined, undefined, '_foreignName'],
      ['_CALL', '_SAFE', '"sin"', 'c_underscore'],
      ['ccall', undefined, undefined, '_SAFE'],
      ['ccall', '_', '"sin"', 'c_singleSafety'],
      ['_', 'safe', '"sin"', 'c_singleCall'],
    ]);
    expect(
      tree.rootNode
        .descendantsOfType('foreign_export')
        .map((node) => [
          node.childForFieldName('calling_convention')?.text,
          node.childForFieldName('entity')?.text,
          node.childForFieldName('signature')?.childForFieldName('name')?.text,
        ])
    ).toEqual([['_CALL', '"hs_echo"', 'hs_echo']]);
    const fields = imports.flatMap((node) =>
      ['calling_convention', 'safety'].flatMap((field) => {
        const value = node.childForFieldName(field);
        return value
          ? [[value.text, value.startPosition.row, value.startPosition.column, value.endPosition.column]]
          : [];
      })
    );
    expect(fields).toEqual([
      ['CALLCONV', 9, 15, 23],
      ['SAFE_ON_WIN', 9, 24, 35],
      ['CALL64', 10, 15, 21],
      ['SAFE64', 10, 22, 28],
      ['ccall', 11, 15, 20],
      ['SAFE64', 11, 21, 27],
      ['CALL64', 12, 15, 21],
      ['CALL64suffix', 13, 15, 27],
      ['SAFE64suffix', 13, 28, 40],
      ['ccall', 14, 15, 20],
      ['_CALL', 17, 15, 20],
      ['_SAFE', 17, 21, 26],
      ['ccall', 18, 15, 20],
      ['ccall', 22, 15, 20],
      ['_', 22, 21, 22],
      ['_', 25, 15, 16],
      ['safe', 25, 17, 21],
    ]);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
    for (const query of queries) expect(() => query.captures(tree.rootNode)).not.toThrow();
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('parses safety keywords and macros in place of a safety macro', () => {
  const original = fs.readFileSync(path.join(root, 'test/fixtures/foreignSafetyMacros.hs'), 'utf8');
  const startIndex = original.indexOf('SAFE_ON_WIN "sin"');
  const parser = new Parser().setLanguage(language);
  try {
    for (const safety of ['SAFE64', 'safe', 'interruptible', 'SAFE_2']) {
      const tree = parser.parse(
        original.slice(0, startIndex) + safety + original.slice(startIndex + 'SAFE_ON_WIN'.length)
      )!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.descendantsOfType('foreign_import')[0]?.childForFieldName('safety')?.text).toBe(safety);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('does not split an uppercase identifier into a safety prefix and a foreign binding name', () => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse('foreign import ccall SAFE64suffix :: Int\nfollowing = 1\n')!;
  try {
    expect(tree.rootNode.hasError).toBe(true);
    expect(
      tree.rootNode
        .descendantsOfType('foreign_import')
        .flatMap((node) => node.childForFieldName('signature')?.childForFieldName('name')?.text ?? [])
    ).not.toContain('suffix');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains following declarations through errors and repairs outside foreign syntax', () => {
  let source = 'foo = ) _bar\nx = 1\ny = ) Maybe\nz = 2\nf :: ) Int\ng = 3\nh = ) _\nk = 4\n';
  const parser = new Parser().setLanguage(language);
  try {
    for (;;) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(source.includes(')'));
        expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
          'foo',
          'x',
          'y',
          'z',
          'g',
          'h',
          'k',
        ]);
        expect(
          tree.rootNode.descendantsOfType('signature').map((node) => node.childForFieldName('name')?.text)
        ).toEqual(['f']);
      } finally {
        tree.delete();
      }
      if (!source.includes(')')) break;
      source = source.replace(')', '');
    }
  } finally {
    parser.delete();
  }
});
