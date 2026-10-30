import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));

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
])('parses type variables and binders: %s', (declaration) => {
  const source = `${declaration}\nvalue a = let local = a in local\n`;
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
  } finally {
    tree.delete();
    parser.delete();
  }
});
