import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));

test('preserves subtraction after grouped names instead of applying them to negative arguments', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const expression of [
      '(f) - x',
      '((f)) - x',
      '((Demo.f)) - x',
      '(((<+>))) - x',
      '(f) - -x',
      '(f) {- comment -} - x',
      '(f)\n  - x',
    ]) {
      const source = `result = ${expression}\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        const declaration = tree.rootNode.childForFieldName('declarations')?.firstNamedChild;
        expect(declaration?.childForFieldName('match')?.childForFieldName('expression')?.type, source).toBe(
          'operator_chain'
        );
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('normalizes grouped name expressions', () => {
  const parser = new Parser().setLanguage(language);
  const source = 'held = (((f)))\ncalled = (((f))) (-x)\n';
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const names = tree.rootNode.descendantsOfType('parenthesized_name');
    expect(names.map((node) => node.text)).toEqual(['(((f)))', '(((f)))']);
    expect(names.map((node) => node.namedChildren.map((child) => [child.type, child.text]))).toEqual([
      [['variable', 'f']],
      [['variable', 'f']],
    ]);
    expect(tree.rootNode.descendantsOfType('operator_chain').map((node) => node.text)).toEqual(['-x']);
    expect(tree.rootNode.descendantsOfType('prefix_negation').map((node) => node.text)).toEqual(['-']);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains left-associative application when grouped names occupy argument positions', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const [callee, grouped, finalArgument] of [
      ['map', '(helper)', 'xs'],
      ['f', '(g)', 'h'],
      ['f', '(Demo.g)', 'h'],
      ['f', '((<+>))', 'h'],
      ['f', '(((g)))', 'h'],
    ] as const) {
      const source = `result = ${callee} ${grouped} ${finalArgument}\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        const expression = tree.rootNode
          .childForFieldName('declarations')
          ?.firstNamedChild?.childForFieldName('match')
          ?.childForFieldName('expression');
        expect(expression?.type, source).toBe('apply');
        expect(expression?.childForFieldName('argument')?.text, source).toBe(finalArgument);
        const firstApplication = expression?.childForFieldName('function');
        expect(firstApplication?.type, source).toBe('apply');
        expect(firstApplication?.childForFieldName('function')?.text, source).toBe(callee);
        expect(firstApplication?.childForFieldName('argument')?.text, source).toBe(grouped);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
