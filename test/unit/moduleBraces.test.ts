import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { beforeAll, describe, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();

describe.each(['haskell', 'hsc', 'haskell_ghc2021'] as const)('%s explicit module bodies', (name) => {
  let language: Language;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, name));
  }, 180_000);

  test.each([
    'module Main where { value = 1 }',
    'module Main where { value = 1 }\n',
    'module Main where {\nvalue = 1\n}\n',
    '{ value = 1 }\n',
    'module Main where { value = 1 }\n-- trailing comment\n\n',
    'module Main where\n{\nvalue = 1\n}',
    'module Main where {\nimport Data.List (\nsort\n);\nvalue = sort [2,1]\n}',
    'module Main (value) where { value = let { x = 1 } in x }',
  ])('preserves source braces and body declarations: %s', (source) => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
      const braces = tree.rootNode.children.filter((node) => node?.type === '{' || node?.type === '}');
      expect(braces.map((node) => [node?.type, node?.text])).toEqual([
        ['{', '{'],
        ['}', '}'],
      ]);
      expect(
        tree.rootNode
          .childForFieldName('declarations')
          ?.descendantsOfType('bind')
          .map((node) => node.childForFieldName('name')?.text)
      ).toContain('value');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

describe.each(['haskell', 'hsc', 'haskell_ghc2021'] as const)('%s module brace errors', (name) => {
  test.each(['module Main where { value = 1', 'module Main where { value = 1 }}'])(
    'reports unbalanced braces: %s',
    async (source) => {
      const language = await Language.load(currentWasmPath(root, name));
      const parser = new Parser().setLanguage(language);
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(true);
      } finally {
        tree.delete();
        parser.delete();
      }
    }
  );
});

describe('GHC2021 module body indentation', () => {
  test.each([
    '  import Data.List\n  value=sort [2,1]\n',
    '  x=1\n  value=x\n',
    'module Main where\n  import Data.List\n  value=sort [2,1]\n',
  ])('uses the first body token column: %s', async (source) => {
    const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, 'haskell_ghc2021')));
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

test('GHC2021 declarations cannot dedent past an initial import', async () => {
  const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, 'haskell_ghc2021')));
  const tree = parser.parse('  import Data.List\nvalue=sort [2,1]\n')!;
  try {
    expect(tree.rootNode.hasError).toBe(true);
  } finally {
    tree.delete();
    parser.delete();
  }
});

describe.each(['haskell', 'hsc', 'haskell_ghc2021'] as const)('%s nested explicit layouts', (name) => {
  test.each([50, 1200])('preserves %i nested brace scopes and following declarations', async (depth) => {
    const source = `module Main where\nvalue=${'let { x = '.repeat(depth)}1${' } in x'.repeat(depth)}\nfollowing=2\n`;
    const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, name)));
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
      expect(tree.rootNode.descendantsOfType('let_in')).toHaveLength(depth);
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.childForFieldName('name')?.text).toBe(
        'following'
      );
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

describe.each(['haskell', 'hsc', 'haskell_ghc2021'] as const)('%s alternating context scopes', (name) => {
  test.each([2, 50, 1200])('closes %i nested parentheses and explicit layouts', async (depth) => {
    const source = `value=${'(let { x = '.repeat(depth)}1${' } in x)'.repeat(depth)}\nfollowing=2\n`;
    const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, name)));
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
      expect(tree.rootNode.descendantsOfType('bind').at(-1)?.text).toBe('following=2');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

describe.each(['haskell', 'hsc', 'haskell_ghc2021'] as const)('%s compound scopes', (name) => {
  test.each([
    ['(let { x = (let { y = let z = ', ' in z } in y) } in x)', 3],
    ['[let { x = [let { y = let z = ', ' in z } in y] } in x]', 3],
    ['(let { x = (let { y = do ', ' } in y) } in x)', 2],
  ] as const)('preserves nested compound contexts: %s', async (open, close, letsPerBlock) => {
    const depth = 200;
    const parser = new Parser().setLanguage(await Language.load(currentWasmPath(root, name)));
    const tree = parser.parse(`value=${open.repeat(depth)}1${close.repeat(depth)}\nfollowing=2\n`)!;
    try {
      expect(tree.rootNode.hasError, tree.rootNode.toString()).toBe(false);
      expect(tree.rootNode.descendantsOfType('let_in')).toHaveLength(depth * letsPerBlock);
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following=2');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});
