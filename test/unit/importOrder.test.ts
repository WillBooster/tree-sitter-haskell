import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const parsers = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (dialect) => {
    const parser = new Parser();
    parser.setLanguage(await Language.load(currentWasmPath(path.resolve(import.meta.dirname, '../..'), dialect)));
    return parser;
  })
);
afterAll(() => {
  for (const parser of parsers) parser.delete();
});

const declarations = ['value = 1', 'value :: Int', 'data Value = Value', 'type Value = Int', '$(pure [])'];

for (const [dialect, parser] of ['Haskell', 'HSC'].map((name, index) => [name, parsers[index]!] as const)) {
  test.each(declarations)(`${dialect} rejects an import after %s`, (declaration) => {
    for (const source of [
      `${declaration}\nimport Data.Maybe\n`,
      `module Probe where\nimport Data.List\n${declaration}\nimport Data.Maybe\n`,
    ]) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(true);
      } finally {
        tree.delete();
      }
    }
  });

  test.each([
    'import Data.Maybe\nimport Data.List\nvalue = Just 1\nfollowing = value\n',
    'module Probe where\nimport Data.Maybe\n-- between sections\nvalue = Just 1\nfollowing = value\n',
    'module Probe where\nvalue = Just 1\nfollowing = value\n',
    'imported = 1\nvalue = imported\nfollowing = value\n',
  ])(`${dialect} preserves initial imports and following bindings: %j`, (source) => {
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        ...(source.startsWith('imported') ? ['imported'] : []),
        'value',
        'following',
      ]);
      const imports = tree.rootNode.childForFieldName('imports');
      expect(
        tree.rootNode
          .descendantsOfType('import')
          .filter((node) => node.isNamed)
          .every((node) => node.parent?.id === imports?.id)
      ).toBe(true);
    } finally {
      tree.delete();
    }
  });
}
