import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const ghc2021 = await Language.load(currentWasmPath(root, 'haskell_ghc2021'));

test.each(['#', '##', '###', '#+', '+#'])('GHC2021 keeps adjacent %s operators outside literal tokens', (operator) => {
  const literals = ['"hello"', "'a'", '1', '1.5', '1e2', '0o7', '0xF'];
  const source =
    literals.map((literal, index) => `value${index}=${literal}${operator}${literal}`).join('\n') + '\nfollowing=1\n';
  const parser = new Parser().setLanguage(ghc2021);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
    expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual(literals.map(() => operator));
    expect(tree.rootNode.descendantsOfType(['string', 'char', 'integer', 'float']).map((node) => node.text)).toEqual([
      ...literals.flatMap((literal) => [literal, literal]),
      '1',
    ]);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('GHC2021 keeps hashes outside identifiers and sized-literal-like operands', () => {
  const source =
    'left=1\nright=2\ndata X=Left|Right|Int8\nvalue=left#right\nconstructors=Left#Right\nsized=1#Int8\nfollowing=1\n';
  const parser = new Parser().setLanguage(ghc2021);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual(['#', '#', '#']);
    expect(tree.rootNode.descendantsOfType('integer').map((node) => node.text)).toEqual(['1', '2', '1', '1']);
    expect(tree.rootNode.descendantsOfType('variable').some((node) => node.text.includes('#'))).toBe(false);
    expect(tree.rootNode.descendantsOfType('constructor').some((node) => node.text.includes('#'))).toBe(false);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each(['(#1)', '(1#)', '(#Int8)', '(#)'])('GHC2021 retains the parenthesized hash operator in %s', (expression) => {
  const parser = new Parser().setLanguage(ghc2021);
  const tree = parser.parse(`value=${expression}\nfollowing=1\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual(['#']);
    expect(tree.rootNode.descendantsOfType('label')).toHaveLength(0);
    expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(0);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each(['', ' '])('GHC2021 keeps hash class operators at tight identifier boundaries (%j)', (gap) => {
  const source = `class a${gap}#${gap}b where\nf::(Int${gap}#${gap}Bool)=>Int\nf=1\ninstance Int${gap}#${gap}Bool where\n`;
  const parser = new Parser().setLanguage(ghc2021);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
    expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual(['#', '#', '#']);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each(['haskell', 'hsc'] as const)('%s retains extension literal suffixes', async (name) => {
  const hash = name === 'hsc' ? '##' : '#';
  const source = `integer=1${hash}\nfloating=1.5${hash}\ncharacter='a'${hash}\ntext="a"${hash}\nfollowing=1\n`;
  const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, name)));
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType(['integer', 'float', 'char', 'string']).map((node) => node.text)).toEqual([
      `1${hash}`,
      `1.5${hash}`,
      `'a'${hash}`,
      `"a"${hash}`,
      '1',
    ]);
  } finally {
    tree.delete();
    parser.delete();
  }
});
