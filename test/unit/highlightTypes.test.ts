import fs from 'node:fs';
import path from 'node:path';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));
let query: Query;
beforeAll(() => {
  query = new Query(language, fs.readFileSync(path.join(root, 'queries/highlights.scm'), 'utf8'));
}, 180_000);
afterAll(() => query.delete());

test.each([
  'f :: forall a. a -> a',
  'f :: forall {k} (a :: k). a -> a',
  'f :: forall a -> a -> a',
  'f :: forall c a. c => a -> a',
  'type Alias (a :: k) = Maybe a',
  'type family Invisible @k (a :: k)',
  'data Box a = Box a',
  'class Named a',
  'class C a b | a -> b',
  'type family F a = r | r -> a',
])('highlights type variables and binders without coloring value names as types: %s', (declaration) => {
  const source = `${declaration}\nvalue a = let local = a in local\n`;
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
    const actual = query
      .captures(tree.rootNode)
      .filter(({ name, node }) => name === 'type' && node.type === 'variable')
      .map(({ node }) => [node.startIndex, node.endIndex]);
    const expected = [...declaration.matchAll(/\b[abckr]\b/g)].map(({ index }) => [index, index + 1]);
    expect(actual, source).toEqual(expected);
    const parameter = source.indexOf('value a') + 'value '.length;
    expect(
      query
        .captures(tree.rootNode)
        .some(({ name, node }) => name === 'variable.parameter' && node.startIndex === parameter)
    ).toBe(true);
  } finally {
    tree.delete();
    parser.delete();
  }
});
