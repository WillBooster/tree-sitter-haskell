import { afterAll, expect, test } from 'vitest';
import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';

await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(path.join(import.meta.dirname, '../../tree-sitter-haskell.wasm')));
afterAll(() => parser.delete());

test.each([
  ['LF spaces', '\n', '  '],
  ['LF tab', '\n', '\t'],
  ['CRLF spaces', '\r\n', '  '],
  ['CRLF tab', '\r\n', '\t'],
])('retains the Haddock continuation and stops at a blank line with %s', (_name, newline, indent) => {
  const documentation = `-- | Documentation${newline}${indent}-- Continuation`;
  const source = `${documentation}${newline}${newline}-- Separate comment${newline}f :: Int${newline}`;
  const tree = parser.parse(source);
  expect(tree).not.toBeNull();
  try {
    expect(tree!.rootNode.hasError).toBe(false);
    expect(tree!.rootNode.descendantsOfType('haddock').map((node) => node.text)).toEqual([documentation]);
    expect(tree!.rootNode.descendantsOfType('comment').map((node) => node.text)).toEqual(['-- Separate comment']);
  } finally {
    tree?.delete();
  }
});
