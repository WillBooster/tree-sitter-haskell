import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
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

test('reparses changes between safety keywords and macros identically to a fresh parse', () => {
  let source = fs.readFileSync(path.join(root, 'test/fixtures/foreignSafetyMacros.hs'), 'utf8');
  const original = source;
  const startIndex = source.indexOf('SAFE_ON_WIN "sin"');
  const parser = new Parser().setLanguage(language);
  let tree = parser.parse(source)!;
  let length = 'SAFE_ON_WIN'.length;
  try {
    for (const safety of ['SAFE64', 'safe', 'interruptible', 'SAFE_2', 'SAFE_ON_WIN']) {
      tree.edit(
        new Edit({
          startIndex,
          oldEndIndex: startIndex + length,
          newEndIndex: startIndex + safety.length,
          startPosition: { row: 9, column: 24 },
          oldEndPosition: { row: 9, column: 24 + length },
          newEndPosition: { row: 9, column: 24 + safety.length },
        })
      );
      source = source.slice(0, startIndex) + safety + source.slice(startIndex + length);
      const incremental = parser.parse(source, tree)!;
      tree.delete();
      tree = incremental;
      const fresh = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.descendantsOfType('foreign_import')[0]?.childForFieldName('safety')?.text).toBe(safety);
        expectSameTreeAndCaptures(tree.rootNode, fresh.rootNode);
      } finally {
        fresh.delete();
      }
      length = safety.length;
    }
    expect(source).toBe(original);
  } finally {
    tree.delete();
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

test('retains following declarations through errors, repairs and undo outside foreign syntax', () => {
  const original = 'foo = ) _bar\nx = 1\ny = ) Maybe\nz = 2\nf :: ) Int\ng = 3\nh = ) _\nk = 4\n';
  let source = original;
  const parser = new Parser().setLanguage(language);
  let tree = parser.parse(source)!;
  const removals: number[] = [];
  const edit = (start: number, remove: number, insert: string): void => {
    const lines = source.slice(0, start).split('\n');
    const row = lines.length - 1,
      column = lines.at(-1)!.length;
    tree.edit(
      new Edit({
        startIndex: start,
        oldEndIndex: start + remove,
        newEndIndex: start + insert.length,
        startPosition: { row, column },
        oldEndPosition: { row, column: column + remove },
        newEndPosition: { row, column: column + insert.length },
      })
    );
    source = source.slice(0, start) + insert + source.slice(start + remove);
    const next = parser.parse(source, tree)!;
    tree.delete();
    tree = next;
    const fresh = parser.parse(source)!;
    try {
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'foo',
        'x',
        'y',
        'z',
        'g',
        'h',
        'k',
      ]);
      expect(tree.rootNode.descendantsOfType('signature').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'f',
      ]);
      expectSameTreeAndCaptures(tree.rootNode, fresh.rootNode);
    } finally {
      fresh.delete();
    }
  };
  try {
    expect(tree.rootNode.hasError).toBe(true);
    edit(0, 0, '');
    while (source.includes(')')) {
      const start = source.indexOf(')');
      removals.push(start);
      edit(start, 1, '');
    }
    expect(tree.rootNode.hasError).toBe(false);
    for (const start of removals.toReversed()) edit(start, 0, ')');
    expect(source).toBe(original);
    expect(tree.rootNode.hasError).toBe(true);
  } finally {
    tree.delete();
    parser.delete();
  }
});

function expectSameTreeAndCaptures(actual: Node, expected: Node): void {
  expect(nodeMetadata(actual)).toEqual(nodeMetadata(expected));
  for (const query of queries) {
    const captures = (node: Node): (string | number)[][] =>
      query.captures(node).map(({ name, node: value }) => [name, value.type, value.startIndex, value.endIndex]);
    expect(captures(actual)).toEqual(captures(expected));
  }
}

function nodeMetadata(node: Node): unknown {
  return [
    node.type,
    node.startIndex,
    node.endIndex,
    node.startPosition,
    node.endPosition,
    node.isNamed,
    node.isExtra,
    node.isMissing,
    node.hasError,
    node.childCount,
    node.children.map(nodeMetadata),
  ];
}
