import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
const boundaries = [
  ['mixed operators', '6 * 7 == 42', ['6', '7', '42'], ['*', '=='], []],
  ['unary prefix', '-x', ['x'], [], ['-']],
  ['right prefix', 'x * -y', ['x', 'y'], ['*'], ['-']],
  ['high fixity prefix', '-2 .^. 2', ['2', '2'], ['.^.'], ['-']],
  ['low fixity prefix', '-2 .+. 2', ['2', '2'], ['.+.'], ['-']],
  ['application', 'f x .+. y .^. z', ['f x', 'y', 'z'], ['.+.', '.^.'], []],
  ['parentheses', '(1 .+. 2) .^. 3', ['(1 .+. 2)', '3'], ['.^.'], []],
  ['backticks', 'x `div` y `mod` z', ['x', 'y', 'z'], ['`div`', '`mod`'], []],
  ['qualified operators', '1 Prelude.+ 2 Prelude.* 3', ['1', '2', '3'], ['Prelude.+', 'Prelude.*'], []],
] as const;

await Parser.init();
describe.each(['haskell', 'hsc'] as const)('%s unresolved operator chains', (name) => {
  let language: Language;
  const queries: Query[] = [];
  let tags: Query;
  beforeAll(async () => {
    language = await Language.load(currentWasmPath(root, name));
    for (const folder of name === 'hsc' ? ['queries', 'hsc/queries'] : ['queries']) {
      for (const file of fs.readdirSync(path.join(root, folder)).filter((entry) => entry.endsWith('.scm'))) {
        queries.push(new Query(language, fs.readFileSync(path.join(root, folder, file), 'utf8')));
      }
    }
    tags = new Query(language, fs.readFileSync(path.join(root, 'queries/tags.scm'), 'utf8'));
  }, 180_000);
  afterAll(() => {
    for (const query of queries) query.delete();
    tags.delete();
  });

  test.each(boundaries)('keeps %s in source order', (_label, expression, operands, operators, prefixes) => {
    const source = `{-# LANGUAGE LexicalNegation #-}\nvalue = ${expression}\nfollowing = 1\n`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const chain = expressionFor(tree.rootNode, 'value');
      expect(chain.type).toBe('operator_chain');
      expect(chain.childrenForFieldName('operand').map((node) => node.text)).toEqual(operands);
      expect(chain.childrenForFieldName('operator').map((node) => node.text)).toEqual(operators);
      expect(chain.childrenForFieldName('prefix_operator').map((node) => node.text)).toEqual(prefixes);
      expect(chain.children.some((node) => node.type === 'operator_chain')).toBe(false);
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test('keeps type and pattern chains flat without indexing parameters or constructor names', () => {
    const source = fs.readFileSync(path.join(root, 'test/fixtures/operatorChains.hs'), 'utf8');
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const chains = tree.rootNode.descendantsOfType('infix_chain');
      expect(chains.map((node) => node.childrenForFieldName('operand').map((operand) => operand.text))).toEqual([
        ['a', 'b', 'c'],
        ['Leaf first', 'Leaf second', 'Leaf third'],
        ['Integer', 'Bool', 'Char'],
      ]);
      expect(chains.map((node) => node.childrenForFieldName('operator').map((operator) => operator.text))).toEqual([
        [':+:', ':*:'],
        [':+:', ':*:'],
        [':+:', ':*:'],
      ]);
      const definitions = tags
        .matches(tree.rootNode)
        .filter(({ captures }) => captures.some(({ name: capture }) => capture === 'definition.variable'))
        .flatMap(({ captures }) =>
          captures.filter(({ name: capture }) => capture === 'name').map(({ node }) => node.text)
        );
      expect(definitions).toEqual([
        'original',
        'highNegation',
        'lowNegation',
        'parenthesized',
        'leftSection',
        'rightSection',
        'qualified',
        'first',
        'second',
        'third',
        'following',
      ]);
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test('preserves greedy bodies, application and outer annotations', () => {
    const source = fs.readFileSync(path.join(root, 'test/fixtures/operatorScopes.hs'), 'utf8');
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(
        expressionFor(tree.rootNode, 'greedyLet')
          .childrenForFieldName('operand')
          .map((node) => node.type)
      ).toEqual(['literal', 'let_in']);
      expect(
        expressionFor(tree.rootNode, 'greedyIf')
          .childrenForFieldName('operand')
          .map((node) => node.type)
      ).toEqual(['literal', 'conditional']);
      expect(expressionFor(tree.rootNode, 'blockApply').childForFieldName('argument')?.type).toBe('lambda');
      expect(
        expressionFor(tree.rootNode, 'lambdaRhs')
          .childrenForFieldName('operand')
          .map((node) => node.type)
      ).toEqual(['variable', 'lambda']);
      expect(
        expressionFor(tree.rootNode, 'prefixApply').children.map((node, index) => [
          node.type,
          expressionFor(tree.rootNode, 'prefixApply').fieldNameForChild(index),
        ])
      ).toEqual([
        ['prefix_negation', 'prefix_operator'],
        ['apply', 'operand'],
        ['operator', 'operator'],
        ['variable', 'operand'],
      ]);
      expect(expressionFor(tree.rootNode, 'typed').type).toBe('signature');
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test('keeps one constructor operator distinct from grouped field-type chains', () => {
    const source =
      '{-# LANGUAGE TypeOperators #-}\ntype a :+: b = Either a b\ntype a :*: b = (a, b)\ndata Value = (Int :+: Bool) :<>: (Char :*: Double)\nfollowing = 1\n';
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const constructor = tree.rootNode.descendantsOfType('data_constructor')[0]?.firstNamedChild;
      expect(constructor?.type).toBe('infix');
      expect(constructor?.childrenForFieldName('operator').map((node) => node.text)).toEqual([':<>:']);
      expect(constructor?.childForFieldName('left_operand')?.text).toBe('(Int :+: Bool)');
      expect(constructor?.childForFieldName('right_operand')?.text).toBe('(Char :*: Double)');
      expect(tree.rootNode.descendantsOfType('infix_chain').map((node) => node.text)).toEqual([
        'Int :+: Bool',
        'Char :*: Double',
      ]);
      const invalid = parser.parse(source.replace('(Int :+: Bool) :<>: (Char :*: Double)', 'Int :<>: Bool :*: Char'))!;
      try {
        expect(invalid.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
        expect(
          tags.captures(invalid.rootNode).filter(({ name, node }) => name === 'name' && node.text === 'following')
        ).toHaveLength(1);
      } finally {
        invalid.delete();
      }
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test('indexes only unambiguous single-operator instance and deriving heads', () => {
    const source = fs.readFileSync(path.join(root, 'test/fixtures/operatorInstances.hs'), 'utf8');
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const implementations = tags
        .matches(tree.rootNode)
        .filter(({ captures }) => captures.some(({ name: capture }) => capture === 'reference.implementation'))
        .flatMap(({ captures }) =>
          captures.filter(({ name: capture }) => capture === 'name').map(({ node }) => [node.text, node.startPosition])
        );
      expect(implementations).toEqual([
        [':*:', { row: 7, column: 13 }],
        [':*:', { row: 9, column: 32 }],
      ]);
    } finally {
      tree.delete();
      parser.delete();
    }
  });

  test.each([
    ['block comment', '{- comment -}'],
    ['line comment', '-- comment\n'],
    ['Haddock comment', '{-| docs -}'],
    ['pragma', '{-# SOURCE #-}'],
    ['CPP branch', '\n#if FLAG\n#endif\n'],
  ])('ignores %s inside single-operator implementation heads', (_label, extra) => {
    const parser = new Parser().setLanguage(language);
    try {
      for (const prefix of ['instance', 'deriving instance']) {
        for (let position = 0; position <= 3; position++) {
          const parts = ['Int', ':*:', 'Bool'];
          parts.splice(position, 0, extra);
          const source = `${prefix} ${parts.join(' ')}\nfollowing = 1\n`;
          for (const input of [source, source.replace('Int', 'Int :+: Char')]) {
            const tree = parser.parse(input)!;
            try {
              expect(tree.rootNode.hasError, input).toBe(false);
              const implementations = tags
                .matches(tree.rootNode)
                .filter(({ captures }) => captures.some(({ name }) => name === 'reference.implementation'))
                .flatMap(({ captures }) =>
                  captures
                    .filter(({ name }) => name === 'name')
                    .map(({ node }) => [node.text, node.startIndex, node.endIndex])
                );
              expect(implementations, input).toEqual(
                input === source ? [[':*:', input.indexOf(':*:'), input.indexOf(':*:') + 3]] : []
              );
              expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
            } finally {
              tree.delete();
            }
          }
        }
      }
    } finally {
      parser.delete();
    }
  });

  test.each([2, 32, 256])('retains flat chains through edits and undo with %i operators', (length) => {
    const original = `value x = ${'x + '.repeat(length)}x\nfollowing = 1\n`;
    const parser = new Parser().setLanguage(language);
    let source = original;
    let tree = parser.parse(source)!;
    try {
      for (const replacement of ['*', 'Prelude.+', '`div`']) {
        const start = source.indexOf('+');
        for (const [from, to] of [
          ['+', replacement],
          [replacement, '+'],
        ] as const) {
          const old = source;
          source = source.slice(0, start) + to + source.slice(start + from.length);
          tree.edit(
            new Edit({
              startIndex: start,
              oldEndIndex: start + from.length,
              newEndIndex: start + to.length,
              startPosition: positionAt(old, start),
              oldEndPosition: positionAt(old, start + from.length),
              newEndPosition: positionAt(source, start + to.length),
            })
          );
          const next = parser.parse(source, tree)!;
          tree.delete();
          tree = next;
          const fresh = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError).toBe(false);
            expect(metadata(tree.rootNode)).toEqual(metadata(fresh.rootNode));
            for (const query of queries) {
              const captures = (node: Node): (string | number)[][] =>
                query
                  .captures(node)
                  .map(({ name: capture, node: value }) => [capture, value.type, value.startIndex, value.endIndex]);
              expect(captures(tree.rootNode)).toEqual(captures(fresh.rootNode));
            }
            const chain = expressionFor(tree.rootNode, 'value');
            expect(chain.childrenForFieldName('operand')).toHaveLength(length + 1);
            expect(chain.childrenForFieldName('operator')).toHaveLength(length);
            expect(chain.children.some((node) => node.type === 'operator_chain')).toBe(false);
            expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
          } finally {
            fresh.delete();
          }
        }
      }
      expect(source).toBe(original);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
});

function expressionFor(rootNode: Node, name: string): Node {
  const declaration = rootNode
    .childForFieldName('declarations')
    ?.namedChildren.find((node) => node.childForFieldName('name')?.text === name);
  const expression = declaration?.childForFieldName('match')?.childForFieldName('expression');
  assert.ok(expression, name);
  return expression;
}

function positionAt(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}

function metadata(rootNode: Node): unknown[] {
  const pending = [rootNode],
    result: unknown[] = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    result.push([
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
  return result;
}
