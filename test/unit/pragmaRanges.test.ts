import fs from 'node:fs';
import path from 'node:path';

import { Edit, Language, type Node, Parser, Query } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const resources = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (name) => {
    const language = await Language.load(currentWasmPath(root, name));
    const queries = (name === 'hsc' ? ['queries', 'hsc/queries'] : ['queries']).flatMap((directory) =>
      fs
        .readdirSync(path.join(root, directory))
        .filter((file) => file.endsWith('.scm'))
        .map((file) => new Query(language, fs.readFileSync(path.join(root, directory, file), 'utf8')))
    );
    return { name, language, queries };
  })
);
afterAll(() => {
  for (const { queries } of resources) for (const query of queries) query.delete();
});

for (const { name, language, queries } of resources) {
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
          let source = `${comment}${separator}${pragma}\nmodule Example where\nfollowing = 1\n`;
          let tree = parser.parse(source)!;
          try {
            for (const replacement of ['expanded', 'body']) {
              const from = replacement === 'expanded' ? 'body' : 'expanded';
              const start = source.indexOf(from),
                previousSource = source;
              source = source.slice(0, start) + replacement + source.slice(start + from.length);
              tree.edit(
                new Edit({
                  startIndex: start,
                  oldEndIndex: start + from.length,
                  newEndIndex: start + replacement.length,
                  startPosition: positionAt(previousSource, start),
                  oldEndPosition: positionAt(previousSource, start + from.length),
                  newEndPosition: positionAt(source, start + replacement.length),
                })
              );
              const previous = tree;
              tree = parser.parse(source, previous)!;
              previous.delete();
              const fresh = parser.parse(source)!;
              try {
                expect(tree.rootNode.hasError).toBe(false);
                const node = tree.rootNode.descendantsOfType(['comment', 'haddock'])[0]!;
                const end = source.indexOf(pragma) - separator.length;
                expect([node.text, node.startIndex, node.endIndex]).toEqual([source.slice(0, end), 0, end]);
                expect(
                  tree.rootNode
                    .descendantsOfType('pragma')
                    .map((value) => [value.text, value.startIndex, value.endIndex])
                ).toEqual([[pragma, source.indexOf(pragma), source.indexOf(pragma) + pragma.length]]);
                expect(tree.rootNode.descendantsOfType('header')[0]?.text).toBe('module Example where');
                expect(
                  tree.rootNode.descendantsOfType('bind').map((value) => value.childForFieldName('name')?.text)
                ).toEqual(['following']);
                expect(metadata(tree.rootNode)).toEqual(metadata(fresh.rootNode));
                for (const query of queries)
                  expect(captures(query, tree.rootNode)).toEqual(captures(query, fresh.rootNode));
              } finally {
                fresh.delete();
              }
            }
            expect(source).toBe(`${comment}${separator}${pragma}\nmodule Example where\nfollowing = 1\n`);
          } finally {
            tree.delete();
          }
        }
      }
    } finally {
      parser.delete();
    }
  });
}

function positionAt(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}

function metadata(rootNode: Node): unknown[] {
  const pending = [rootNode],
    nodes = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    nodes.push([
      node.type,
      node.startIndex,
      node.endIndex,
      node.startPosition,
      node.endPosition,
      node.isNamed,
      node.isExtra,
      node.isMissing,
      node.hasError,
      node.childCount,
      node.children.map((_, index) => node.fieldNameForChild(index)),
    ]);
    pending.push(...node.children.toReversed());
  }
  return nodes;
}

function captures(query: Query, node: Node): (string | number)[][] {
  return query.captures(node).map(({ name, node: value }) => [name, value.type, value.startIndex, value.endIndex]);
}
