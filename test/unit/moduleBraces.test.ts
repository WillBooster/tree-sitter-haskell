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
