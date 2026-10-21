import fs from 'node:fs';
import path from 'node:path';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));
const tags = new Query(language, fs.readFileSync(path.join(root, 'queries/tags.scm'), 'utf8'));
afterAll(() => tags.delete());

test('indexes module pattern names at their lexical ranges without tagging local patterns, labels or constructors', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/navigation/destructuredBindings.hs'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const actual = tags
      .matches(tree.rootNode)
      .filter(({ captures }) => captures.some(({ name }) => name === 'definition.variable'))
      .flatMap(({ captures }) => captures.filter(({ name }) => name === 'name'))
      .map(({ node }) => [node.text, node.startPosition.row, node.startPosition.column, node.endPosition.column]);
    expect(actual).toEqual([
      ['first', 5, 1, 6],
      ['second', 5, 8, 14],
      ['extracted', 6, 5, 14],
      ['headValue', 7, 1, 10],
      ['tailValues', 7, 11, 21],
      ['whole', 8, 0, 5],
      ['nestedFirst', 8, 7, 18],
      ['nestedSecond', 8, 21, 33],
      ['nestedThird', 8, 35, 46],
      ['punned', 9, 9, 15],
      ['fieldValue', 9, 32, 42],
      ['viewed', 10, 12, 18],
      ['typed', 11, 2, 7],
      ['typeCompanion', 11, 17, 30],
      ['lazyFirst', 12, 2, 11],
      ['lazySecond', 12, 13, 23],
      ['withDo', 23, 0, 6],
      ['withComprehension', 27, 0, 17],
      ['listFirst', 28, 1, 10],
      ['listSecond', 28, 12, 22],
    ]);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each([1, 32, 256])(
  'indexes module patterns through %i tuple levels without indexing function parameters',
  (depth) => {
    const names = Array.from({ length: depth + 1 }, (_, index) => `item${index}`);
    const localNames = names.map((name) => `local${name}`);
    let pattern = names[depth]!;
    let parameter = localNames[depth]!;
    for (let index = depth - 1; index >= 0; index--) {
      pattern = `(${names[index]}, ${pattern})`;
      parameter = `(${localNames[index]}, ${parameter})`;
    }
    const source = `${pattern} = undefined\nkeep ${parameter} = undefined\n`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const actual = tags
        .matches(tree.rootNode)
        .filter(({ captures }) => captures.some(({ name }) => name === 'definition.variable'))
        .flatMap(({ captures }) => captures.filter(({ name }) => name === 'name'))
        .map(({ node }) => [node.text, node.type, node.startIndex, node.endIndex]);
      expect(actual).toEqual(
        names.map((name) => {
          const start = source.indexOf(name);
          return [name, 'variable', start, start + name.length];
        })
      );
    } finally {
      tree.delete();
      parser.delete();
    }
  }
);
