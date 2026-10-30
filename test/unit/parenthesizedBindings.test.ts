import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));

test('parses deeply grouped simple bindings alongside destructured module bindings and local bindings', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const depth of [1, 2, 10, 50]) {
      const grouped = `${'('.repeat(depth)}named${')'.repeat(depth)}`;
      const source = `${grouped} = 1\nresult = let ${grouped} = 2 in named\n(left, right) = undefined\nfollowing = 3\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text, source).toBe('following = 3');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('parses a grouped simple binding without changing the following declaration', () => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse('((named)) = 1\nfollowing = 2\n')!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 2');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains binding definitions through the existing constructor-synonym alias', () => {
  const parser = new Parser().setLanguage(language);
  const source = 'pattern P <- Just a where ((build)) = Just a\nfollowing = 1\n';
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
  } finally {
    tree.delete();
    parser.delete();
  }
});
