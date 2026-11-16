import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { beforeAll, describe, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();

describe.each(['haskell_ghc2021'] as const)('%s comprehension and quotation boundaries', (name) => {
  let language: Language;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, name));
  }, 180_000);

  test.each([
    '[x|x<-[1..3]]',
    '[x| x <- [1..3]]',
    '[n|n<-[1..5],odd n]',
    '[x|(x,_)<-[(1,2)]]',
    '[x|Just x<-[Just 1]]',
    '[x|x<-"ab"]',
  ])('parses the complete comprehension %s', (expression) => {
    const parser = new Parser().setLanguage(language);
    const source = `value = ${expression}\nfollowing = 1\n`;
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType('list_comprehension').map((node) => node.text.trim())).toEqual([
        expression,
      ]);
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test.each([
    ['pattern :: Int\npattern = 2\nmain = print pattern', 'variable', 'pattern'],
    ['mdo :: Int\nmdo = 1\nmain = print mdo', 'variable', 'mdo'],
    ['main = do\n  rec <- getLine\n  print rec', 'variable', 'rec'],
    ['rec = print 1\nmain = do\n  print 2\n  rec', 'variable', 'rec'],
    ['main = print$negate 1', 'operator', '$'],
    ['main = print$(1)', 'operator', '$'],
    ['import qualified Data.Map as M\nmain = print $ (M.size.M.fromList) [(1,2)]', 'operator', '.'],
    ['main = print (map (show.fst) [(1,2)])', 'operator', '.'],
  ])('parses ordinary lexical syntax: %s', (source, nodeType, token) => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType(nodeType).map((node) => node.text)).toContain(token);
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test.each(['$', '.', '$$'])('parses tight ordinary class operator %s', (operator) => {
    for (const gap of ['', ' ']) {
      const source = `module Constraint where\nclass a ${operator} b where\nf :: (a${gap}${operator}${gap}b) => a -> b\nf = undefined\ninstance Int ${operator} Bool where\n`;
      const parser = new Parser().setLanguage(language);
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
      } finally {
        tree.delete();
        parser.delete();
      }
    }
  });

  test('retains qualified class constraints', () => {
    const source =
      'module Qualified where\nimport qualified Data.Foldable as F\nf :: F.Foldable t => t a -> Int\nf = F.length\n';
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

describe.each(['haskell', 'hsc'] as const)('%s extension quotation boundaries', (name) => {
  let language: Language;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, name));
  }, 180_000);
  test.each(['[x|body|]', '[e|1 + 2|]', '[p|Just x|]', '[t|Maybe Int|]'])('retains quotation %s', (expression) => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(`value = ${expression}\n`)!;
    try {
      expect(tree.rootNode.hasError, expression).toBe(false);
      expect(tree.rootNode.descendantsOfType('list_comprehension')).toHaveLength(0);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});
