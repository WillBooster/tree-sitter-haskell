import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));

test('parses module pattern bindings and quoted local patterns, labels and constructors', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/navigation/destructuredBindings.hs'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const quote = tree.rootNode.descendantsOfType('quoted_decls')[0]!;
    expect(quote.namedChildren.map((node) => node.type)).toEqual([
      'bind',
      'function',
      'bind',
      'bind',
      'bind',
      'bind',
      'data_type',
      'type_synonym',
    ]);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('parses existing simple operator bindings alongside tuple bindings', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/navigation/parenthesizedBindings.hs'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each([1, 32, 256])('parses module patterns through %i tuple levels alongside function parameters', (depth) => {
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
  } finally {
    tree.delete();
    parser.delete();
  }
});
