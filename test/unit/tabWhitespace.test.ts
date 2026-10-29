import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

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

test('parses each partial replacement of spaces by tabs without errors', () => {
  let source = 'f x = case x of\n  A -> x\n';
  for (const index of [...source.matchAll(/(?<=\S) /g)].map((match) => match.index)) {
    source = `${source.slice(0, index)}\t${source.slice(index + 1)}`;
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
    } finally {
      tree.delete();
    }
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
] as const)('counts a tab inside an earlier token toward layout: %j', (source, index) => {
  expect(statements(source)).toHaveLength(1);
  expect(statements(`${source.slice(0, index)}\t${source.slice(index + 1)}`)).toEqual(['x', 'y']);
});

function statements(source: string): string[] {
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
    return tree.rootNode.descendantsOfType('exp').map((node) => node.text);
  } finally {
    tree.delete();
  }
}
