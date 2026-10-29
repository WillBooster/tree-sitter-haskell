import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();

for (const name of ['haskell', 'hsc'] as const) {
  const language = await Language.load(currentWasmPath(root, name));
  test(`${name} preserves opening comment ranges before pragmas and a module header`, () => {
    const parser = new Parser().setLanguage(language);
    const pragma = '{-# LANGUAGE EmptyDataDecls #-}';
    try {
      for (const comment of [
        '{- body -}',
        '{-\n body\n-}',
        '{- | body -}',
        '{-| body -}',
        '{- outer {- body -} tail -}',
      ]) {
        for (const separator of [' ', '\n', '\r\n']) {
          for (const body of ['body', 'expanded']) {
            const source = `${comment.replace('body', body)}${separator}${pragma}\nmodule Example where\nfollowing = 1\n`;
            const tree = parser.parse(source)!;
            try {
              expect(tree.rootNode.hasError).toBe(false);
              const node = tree.rootNode.descendantsOfType(['comment', 'haddock'])[0]!;
              const end = source.indexOf(pragma) - separator.length;
              expect([node.text, node.startIndex, node.endIndex]).toEqual([source.slice(0, end), 0, end]);
              expect(
                tree.rootNode.descendantsOfType('pragma').map((value) => [value.text, value.startIndex, value.endIndex])
              ).toEqual([[pragma, source.indexOf(pragma), source.indexOf(pragma) + pragma.length]]);
              expect(tree.rootNode.descendantsOfType('header')[0]?.text).toBe('module Example where');
              expect(
                tree.rootNode.descendantsOfType('bind').map((value) => value.childForFieldName('name')?.text)
              ).toEqual(['following']);
            } finally {
              tree.delete();
            }
          }
        }
      }
    } finally {
      parser.delete();
    }
  });
}
