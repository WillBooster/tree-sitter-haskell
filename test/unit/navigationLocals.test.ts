import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

test('retains local references for grouped variable callees without treating qualified or symbolic names as locals', async () => {
  await Parser.init();
  const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));
  const parser = new Parser().setLanguage(language);
  const query = new Query(
    language,
    fs.readFileSync(path.join(import.meta.dirname, '../../queries/locals.scm'), 'utf8')
  );
  try {
    for (const depth of [1, 2, 5]) {
      const grouped = `${'('.repeat(depth)}f${')'.repeat(depth)}`;
      for (const argument of ['', ' x', ' @Int x', ' (type Int)']) {
        const source = `result = let f value = value in ${grouped}${argument}\n`;
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
          const references = query.captures(tree.rootNode).filter(({ name }) => name === 'local.reference');
          const callee = references.filter(({ node }) => node.text === 'f');
          const startIndex = source.indexOf(grouped) + depth;
          expect(
            callee.map(({ node }) => [node.startIndex, node.endIndex]),
            source
          ).toEqual([[startIndex, startIndex + 1]]);
          expect(
            references.filter(({ node }) => node.text === 'value'),
            source
          ).toHaveLength(1);
        } finally {
          tree.delete();
        }
      }
    }
    for (const expression of ['((Demo.f)) x', '(((<+>))) x', '(((Demo.<+>))) x']) {
      const tree = parser.parse(`result = ${expression}\n`)!;
      try {
        expect(tree.rootNode.hasError, expression).toBe(false);
        expect(
          query
            .captures(tree.rootNode)
            .filter(({ name }) => name === 'local.reference')
            .map(({ node }) => node.text)
        ).toEqual(['x']);
      } finally {
        tree.delete();
      }
    }
  } finally {
    query.delete();
    parser.delete();
  }
});
