import path from 'node:path';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));

test('keeps dot operators before numeric and quoted operands in applications and right sections', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(language, '(operator) @operator');
  try {
    for (const operandText of ['0', '14', '0xF', '0b10', '0o7', '1_000', '1e3', '1.25', "'True"]) {
      for (const left of ['left', '#foo', '(left)', '[left]', '']) {
        for (const whitespace of ['', ' ', '\t']) {
          const expression = left ? `${left}${whitespace}.${operandText}` : `(${whitespace}.${operandText})`;
          const source = `value = ${expression}\nfollowing = 1\n`;
          const tree = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError, source).toBe(false);
            expect(tree.rootNode.descendantsOfType(left ? 'operator_chain' : 'right_section'), source).toHaveLength(1);
            expect(
              query.captures(tree.rootNode).map(({ node }) => [node.text, node.startIndex, node.endIndex])
            ).toEqual([['.', source.indexOf('.'), source.indexOf('.') + 1]]);
            const expressionNode = tree.rootNode.descendantsOfType(left ? 'operator_chain' : 'right_section')[0]!;
            const operand = left
              ? expressionNode.childrenForFieldName('operand').at(-1)!
              : expressionNode.childForFieldName('right_operand')!;
            expect(operand.text).toBe(operandText);
            expect(operand.startIndex).toBe(source.indexOf(operandText));
            expect(tree.rootNode.descendantsOfType('projection')).toHaveLength(0);
            expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
          } finally {
            tree.delete();
          }
        }
      }
    }
  } finally {
    query.delete();
    parser.delete();
  }
});

test('preserves Unicode record fields, field selectors, and qualified names', () => {
  const source =
    'a = left.field\nb = left.привет\nc = (.field)\nd = Data.List.map\ne = Data.Maybe.Just\nfollowing = 1\n';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('projection').map((node) => node.text)).toEqual([
      'left.field',
      'left.привет',
    ]);
    expect(tree.rootNode.descendantsOfType('projection_selector').map((node) => node.text)).toEqual(['(.field)']);
    expect(tree.rootNode.descendantsOfType('qualified').map((node) => node.text)).toEqual([
      'Data.List.map',
      'Data.Maybe.Just',
    ]);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('parses dots between record fields, numeric operands and quoted names', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const expression of [
      'left.field',
      'left.14',
      'left .14',
      "left .'True",
      "( .'True)",
      'Data.Maybe.Just',
      '(.14)',
      '( .14)',
      '#foo.14',
    ]) {
      const source = `value = ${expression}\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
