import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { beforeAll, describe, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const unboxedNodes = ['unboxed_unit', 'prefix_unboxed_tuple', 'prefix_unboxed_sum', 'unboxed_tuple', 'unboxed_sum'];

describe('GHC2021 boxed syntax', () => {
  let language: Language;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, 'haskell_ghc2021'));
  });

  test.each(['##', '#|#', '###', '#|##'])('parses %s as an ordinary prefix operator in each namespace', (operator) => {
    const source = `(${operator}) a b=a+b
value=(${operator}) 1 2
f (${operator})=(${operator}) 1 2
local=let (${operator})=(+) in (${operator}) 1 2
type a ${operator} b=(a,b)
type T a b=(${operator}) a b
following=1
`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType(unboxedNodes), source).toHaveLength(0);
      const declarations = tree.rootNode.childForFieldName('declarations')!;
      expect(declarations.firstNamedChild?.type).toBe('function');
      expect(declarations.firstNamedChild?.childForFieldName('name')?.type).toBe('prefix_id');
      expect(declarations.firstNamedChild?.childForFieldName('name')?.firstNamedChild?.text).toBe(operator);
      const names = tree.rootNode.descendantsOfType('prefix_id').filter((node) => node.text === `(${operator})`);
      expect(names).toHaveLength(7);
      expect(names.map((node) => node.firstNamedChild?.type)).toEqual(Array.from({ length: 7 }, () => 'operator'));
      expect(declarations.lastNamedChild?.text).toBe('following=1');
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test.each([
    'value=(# #)',
    'value=(#| #)',
    'value=(#,#)',
    'value=(# 1,2 #)',
    'value=(# | 1 #)',
    'f (# a,b #)=a',
    'value=let (# a,b #)=undefined in a',
    'type T=(# Int,Bool #)',
    'type T=(# Int | Bool #)',
    'data T=(##)',
    'data T=(# Int,Bool #)',
    'data T=(# Int | #)',
  ])('reports extension syntax as an error: %s', (source) => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(true);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

describe.each(['haskell', 'hsc'] as const)('%s unboxed extensions', (name) => {
  let language: Language;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, name));
  });

  test.each([
    ['value=(##)', 'unboxed_unit'],
    ['value=(#,#)', 'prefix_unboxed_tuple'],
    ['value=(# | #)', 'prefix_unboxed_sum'],
    ['value=(# 1,2 #)', 'unboxed_tuple'],
    ['value=(# | 1 #)', 'unboxed_sum'],
    ['f (# a,b #)=a', 'unboxed_tuple'],
    ['value=let (# a,b #)=undefined in a', 'unboxed_tuple'],
    ['type T=(# Int,Bool #)', 'unboxed_tuple'],
    ['type T=(# Int | Bool #)', 'unboxed_sum'],
    ['data T=(##)', 'unboxed_unit'],
    ['data T=(# Int,Bool #)', 'unboxed_tuple'],
    ['data T=(# Int | #)', 'unboxed_sum'],
  ])('retains full parsing of %s', (source, nodeType) => {
    const parser = new Parser().setLanguage(language);
    const input = name === 'hsc' ? source.replaceAll('#', '##') : source;
    const tree = parser.parse(input)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
      expect(tree.rootNode.descendantsOfType(nodeType)).toHaveLength(1);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});
