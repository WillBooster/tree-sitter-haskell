import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

test('parses grouped variable callees and grouped qualified or symbolic names', async () => {
  await Parser.init();
  const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));
  const parser = new Parser().setLanguage(language);
  try {
    for (const depth of [1, 2, 5]) {
      const grouped = `${'('.repeat(depth)}f${')'.repeat(depth)}`;
      for (const argument of ['', ' x', ' @Int x', ' (type Int)']) {
        const source = `result = let f value = value in ${grouped}${argument}\n`;
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
        } finally {
          tree.delete();
        }
      }
    }
    for (const expression of ['((Demo.f)) x', '(((<+>))) x', '(((Demo.<+>))) x']) {
      const tree = parser.parse(`result = ${expression}\n`)!;
      try {
        expect(tree.rootNode.hasError, expression).toBe(false);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
