import { afterAll, expect, test } from 'vitest';
import path from 'node:path';

import { Edit, Language, Parser } from '@willbooster/web-tree-sitter';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..'))));
afterAll(() => parser.delete());

const programs = [
  'f x = x\n',
  'f :: C a => a -> a\nf x = x\n',
  'f = case x of\n  A -> x\n',
  'f = let x = 1 in x\n',
  'f = do\n  x <- action\n  pure x\n',
  'data T = T { field :: Int }\n',
  'import qualified Data.List as List\nf = List.sort []\n',
  'f = [ x | x <- xs ]\n',
];

test.each(programs)('treats tabs between tokens as whitespace in %j', (source) => {
  const tabbed = source.replaceAll(/(?<=\S) /g, '\t');
  const reference = parser.parse(source)!;
  const actual = parser.parse(tabbed)!;
  try {
    expect(reference.rootNode.hasError).toBe(false);
    expect(actual.rootNode.hasError).toBe(false);
    expect(actual.rootNode.toString()).toBe(reference.rootNode.toString());
  } finally {
    reference.delete();
    actual.delete();
  }
});

test('preserves tab-indented do continuation and the following statement', () => {
  const source = 'f = do\n  let x = first\n\t|| second\n  pure x\n';
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('operator_chain').map((node) => node.text)).toEqual(['first\n\t|| second']);
    expect(tree.rootNode.descendantsOfType('exp').map((node) => node.text)).toEqual(['pure x']);
  } finally {
    tree.delete();
  }
});

test.each(['--\t| Documentation', '{-\t| Documentation -}'])(
  'recognizes a tab before the Haddock marker: %s',
  (documentation) => {
    const tree = parser.parse(`${documentation}\nf = 1\n`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('haddock').map((node) => node.text)).toEqual([documentation]);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'f',
      ]);
    } finally {
      tree.delete();
    }
  }
);

test('reparses spaces replaced by tabs consistently with a fresh parse', () => {
  let source = 'f x = case x of\n  A -> x\n';
  let tree = parser.parse(source)!;
  try {
    for (const index of [...source.matchAll(/(?<=\S) /g)].map((match) => match.index)) {
      const before = source.slice(0, index).split('\n');
      const startPosition = { row: before.length - 1, column: before.at(-1)!.length };
      const endPosition = { row: startPosition.row, column: startPosition.column + 1 };
      tree.edit(
        new Edit({
          startIndex: index,
          oldEndIndex: index + 1,
          newEndIndex: index + 1,
          startPosition,
          oldEndPosition: endPosition,
          newEndPosition: endPosition,
        })
      );
      source = `${source.slice(0, index)}\t${source.slice(index + 1)}`;
      const next = parser.parse(source, tree)!;
      tree.delete();
      tree = next;
      const fresh = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.toString()).toBe(fresh.rootNode.toString());
      } finally {
        fresh.delete();
      }
    }
  } finally {
    tree.delete();
  }
});

test.each([
  String.raw`\n`,
  String.raw`\t`,
  String.raw`\NUL`,
  String.raw`\^A`,
  String.raw`\'`,
  String.raw`\\`,
  String.raw`\123`,
  String.raw`\o17`,
  String.raw`\xFF`,
])('keeps tab-separated escaped character declarations distinct: %s', (escape) => {
  const source = `a\t=\t'${escape}'\nb\t=\t'\\t'\n`;
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('char').map((node) => node.text)).toEqual([`'${escape}'`, String.raw`'\t'`]);
    expect(tree.rootNode.descendantsOfType('bind')).toHaveLength(2);
  } finally {
    tree.delete();
  }
});

test.each([
  'f = do\tx\n\ty\n',
  'f\t= do\tx\n\t\ty\n',
  'f = do\n \tx\n        y\n',
  'f = do {-\t-} x\n                   y\n',
  'f = ("\t", do x\n              y)\n',
  'f = do\tx\r\n\ty\r\n',
])('uses eight-column tab stops for layout in %j', (source) => {
  let column = 0;
  const expanded = source
    .split('')
    .map((character) => {
      if (character === '\n' || character === '\r' || character === '\f') {
        column = 0;
        return character;
      }
      const width = character === '\t' ? 8 - (column % 8) : 1;
      column += width;
      return character === '\t' ? ' '.repeat(width) : character;
    })
    .join('');
  const reference = parser.parse(expanded)!;
  const actual = parser.parse(source)!;
  try {
    expect(reference.rootNode.hasError).toBe(false);
    expect(actual.rootNode.hasError).toBe(false);
    expect(actual.rootNode.toString()).toBe(reference.rootNode.toString());
  } finally {
    reference.delete();
    actual.delete();
  }
});

test.each([
  ['f = (" ", do x\n              y)\n', 6],
  ['f = do {- -} x\n                   y\n', 9],
] as const)('updates layout after editing a tab inside an earlier token: %j', (source, index) => {
  let tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const originalStatements = tree.rootNode.descendantsOfType('exp').map((node) => node.text);
    expect(originalStatements).toHaveLength(1);
    for (const character of ['\t', ' ']) {
      tree.edit(
        new Edit({
          startIndex: index,
          oldEndIndex: index + 1,
          newEndIndex: index + 1,
          startPosition: { row: 0, column: index },
          oldEndPosition: { row: 0, column: index + 1 },
          newEndPosition: { row: 0, column: index + 1 },
        })
      );
      const edited = `${source.slice(0, index)}${character}${source.slice(index + 1)}`;
      const next = parser.parse(edited, tree)!;
      tree.delete();
      tree = next;
      const fresh = parser.parse(edited)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.toString()).toBe(fresh.rootNode.toString());
        expect(tree.rootNode.descendantsOfType('exp').map((node) => node.text)).toEqual(
          character === '\t' ? ['x', 'y'] : originalStatements
        );
      } finally {
        fresh.delete();
      }
    }
  } finally {
    tree.delete();
  }
});
