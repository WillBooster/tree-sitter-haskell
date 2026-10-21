import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));
const queries: Query[] = [];
beforeAll(() => {
  queries.push(
    ...fs
      .readdirSync(path.join(root, 'queries'))
      .filter((file) => file.endsWith('.scm'))
      .map((file) => new Query(language, fs.readFileSync(path.join(root, 'queries', file), 'utf8')))
  );
}, 180_000);
afterAll(() => {
  for (const query of queries) query.delete();
});

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
            expect(tree.rootNode.descendantsOfType(left ? 'infix' : 'right_section'), source).toHaveLength(1);
            expect(
              query.captures(tree.rootNode).map(({ node }) => [node.text, node.startIndex, node.endIndex])
            ).toEqual([['.', source.indexOf('.'), source.indexOf('.') + 1]]);
            const operand = tree.rootNode
              .descendantsOfType(left ? 'infix' : 'right_section')[0]!
              .childForFieldName('right_operand')!;
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

test('reparses dots when record fields become numeric operands or quoted names', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  let expression = 'left.field';
  let tree = parser.parse(prefix + expression + suffix)!;
  try {
    for (const replacement of [
      'left.14',
      'left .14',
      "left .'True",
      "( .'True)",
      'Data.Maybe.Just',
      '(.14)',
      '( .14)',
      '#foo.14',
      'left.field',
    ]) {
      tree.edit(
        new Edit({
          startIndex: prefix.length,
          oldEndIndex: prefix.length + expression.length,
          newEndIndex: prefix.length + replacement.length,
          startPosition: { row: 0, column: prefix.length },
          oldEndPosition: { row: 0, column: prefix.length + expression.length },
          newEndPosition: { row: 0, column: prefix.length + replacement.length },
        })
      );
      const source = prefix + replacement + suffix;
      const previous = tree;
      tree = parser.parse(source, previous)!;
      previous.delete();
      const fresh = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
        for (const query of queries) {
          const captures = (node: Node): unknown =>
            query.captures(node).map(({ name, node }) => [name, snapshot(node)]);
          expect(captures(tree.rootNode)).toEqual(captures(fresh.rootNode));
        }
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        fresh.delete();
      }
      expression = replacement;
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

function snapshot(node: Node): unknown {
  return [
    node.type,
    node.startIndex,
    node.endIndex,
    node.startPosition,
    node.endPosition,
    node.isNamed,
    node.isExtra,
    node.isMissing,
    node.hasError,
    node.children.map((child, index) => [node.fieldNameForChild(index), snapshot(child)]),
  ];
}
