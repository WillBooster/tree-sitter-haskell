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
  for (const file of fs.readdirSync(path.join(root, 'queries')).filter((file) => file.endsWith('.scm'))) {
    queries.push(new Query(language, fs.readFileSync(path.join(root, 'queries', file), 'utf8')));
  }
}, 180_000);
afterAll(() => {
  for (const query of queries) query.delete();
});

test('retains complete modern labels at exact lexical ranges beside MagicHash and unboxed syntax', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/modernLabels.hs'), 'utf8');
  const labels = [
    '#foo',
    '#Foo',
    '#3',
    '#17a23b',
    '#2_3',
    '#do',
    '#type',
    "#f'a'",
    "#'a'",
    "#'",
    "#''notTHSplice",
    '#привет',
    '#こんにちは',
    '#""',
    '#"Hello, World!"',
    String.raw`#"\""`,
    '#"continued\\\n  \\line"',
    '#"3.14"',
    '#"..."',
    '#hello',
    '#world',
    '#"hello"',
    '#"world"',
    '#Foo',
  ];
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const actual = tree.rootNode.descendantsOfType('label');
    expect(actual.map((node) => node.text)).toEqual(labels);
    let offset = 0;
    for (const [index, label] of labels.entries()) {
      const start = source.indexOf(label, offset);
      expect(start).toBeGreaterThanOrEqual(offset);
      expect([actual[index]!.startIndex, actual[index]!.endIndex, actual[index]!.childCount]).toEqual([
        start,
        start + label.length,
        0,
      ]);
      offset = start + label.length;
    }
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual(['"hello"#']);
    expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('keeps CPP boundaries and the declaration after modern labels', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/modernLabelsCpp.hs'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('label').map((node) => node.text)).toContain('#Foo');
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('ends bare and quoted labels before following operators', () => {
  const source = 'numeric = #3.14\nquoted = #"hello"# 1\nfollowing = 1\n';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('label').map((node) => node.text)).toEqual(['#3', '#"hello"']);
    expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual(['.', '#']);
    expect(tree.rootNode.descendantsOfType('integer').map((node) => node.text)).toEqual(['14', '1', '1']);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each(['#...', '# "text"'])('does not turn %s into an overloaded label', (expression) => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(`value = ${expression}\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(true);
    expect(tree.rootNode.descendantsOfType('label')).toHaveLength(0);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each([' ', '\t', '\n', '\r', '\r\n', '\v', '\f', '\u00A0', '\u2028', '\u2029'])(
  'shares whitespace gaps between quoted labels and ordinary strings (%j)',
  (gap) => {
    const quoted = '"gap\\' + gap + String.raw`\"`;
    const source = `value = #${quoted}\nordinary = ${quoted}\nfollowing = 1\n`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const label = tree.rootNode.descendantsOfType('label')[0]!;
      expect([label.text, label.startIndex, label.endIndex, label.childCount]).toEqual([
        '#' + quoted,
        source.indexOf('#'),
        source.indexOf('#') + quoted.length + 1,
        0,
      ]);
      expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([quoted]);
      expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
    } finally {
      tree.delete();
      parser.delete();
    }
  }
);

test('shares valid escape boundaries between quoted labels and ordinary strings', () => {
  const spellings = [
    String.raw`"a\^Ab"`,
    String.raw`"a\o17b"`,
    String.raw`"a\x123b"`,
    String.raw`"a\123b"`,
    String.raw`"a\NULb"`,
    String.raw`"a\&b"`,
    '"a\u00A0b"',
  ];
  const source =
    spellings.map((text, index) => `label${index} = #${text}\nstring${index} = ${text}\n`).join('') + 'following = 1\n';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('label').map((node) => node.text)).toEqual(
      spellings.map((text) => '#' + text)
    );
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual(spellings);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test.each([
  String.raw`"a\zb"`,
  String.raw`"a\^ab"`,
  String.raw`"a\ b"`,
  ...['\t', '\r', '\v', '\f', '\u2028', '\u200D'].map((character) => '"a' + character + 'b"'),
])('rejects invalid quoted-label content %j', (quoted) => {
  const parser = new Parser().setLanguage(language);
  try {
    const tree = parser.parse(`value = #${quoted}\nfollowing = 1\n`)!;
    try {
      expect(tree.rootNode.hasError).toBe(true);
      expect(tree.rootNode.descendantsOfType('label').map((node) => node.text)).not.toContain('#' + quoted);
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
});

test('keeps unspaced unboxed delimiters ahead of label-like first elements', () => {
  const elements = ['Bar', '1', '"a"', "'c'", '#Foo'];
  const expressions = elements.map((element) => `(#${element}, right #)`);
  const source =
    expressions.map((expression, index) => `tuple${index} = ${expression}\n`).join('') +
    'sum = (#| right #)\nboxed = ( #Foo)\nfollowing = 1\n';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('unboxed_tuple').map((node) => node.text)).toEqual(expressions);
    expect(
      tree.rootNode
        .descendantsOfType('unboxed_tuple')
        .map((node) =>
          node.children.filter((_, index) => node.fieldNameForChild(index) === 'element').map((node) => node.text)
        )
    ).toEqual(elements.map((element) => [element, 'right']));
    expect(tree.rootNode.descendantsOfType('unboxed_sum').map((node) => node.text)).toEqual(['(#| right #)']);
    expect(tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])).toEqual(
      [source.indexOf('#Foo'), source.lastIndexOf('#Foo')].map((start) => ['#Foo', start, start + 4])
    );
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('preserves unboxed and label roles through spelling and physical-adjacency edits', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  const examples = [
    { expression: '(# left, right #)', labels: [], unboxed: true },
    { expression: '(#Bar, right #)', labels: [], unboxed: true },
    { expression: '(#1, right #)', labels: [], unboxed: true },
    { expression: '(#"a", right #)', labels: [], unboxed: true },
    { expression: "(#'c', right #)", labels: [], unboxed: true },
    { expression: '(##Foo, right #)', labels: ['#Foo'], unboxed: true },
    { expression: '( #Foo)', labels: ['#Foo'], unboxed: false },
    { expression: '({- comment -}#Foo)', labels: ['#Foo'], unboxed: false },
    { expression: '(# left, right #)', labels: [], unboxed: true },
  ];
  let expression = examples[0]!.expression;
  let source = prefix + expression + suffix;
  let tree = parser.parse(source)!;
  try {
    for (const example of examples) {
      const next = example.expression;
      const updated = prefix + next + suffix;
      tree.edit(
        new Edit({
          startIndex: prefix.length,
          oldEndIndex: prefix.length + expression.length,
          newEndIndex: prefix.length + next.length,
          startPosition: point(source, prefix.length),
          oldEndPosition: point(source, prefix.length + expression.length),
          newEndPosition: point(updated, prefix.length + next.length),
        })
      );
      const previous = tree;
      tree = parser.parse(updated, previous)!;
      previous.delete();
      const fresh = parser.parse(updated)!;
      try {
        expect(tree.rootNode.hasError, next).toBe(false);
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
        expect(tree.rootNode.descendantsOfType('unboxed_tuple').map((node) => node.text)).toEqual(
          example.unboxed ? [next] : []
        );
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(
          example.labels.map((label) => [label, updated.indexOf(label), updated.indexOf(label) + label.length])
        );
        for (const query of queries) {
          const captures = (node: Node): unknown =>
            query.captures(node).map(({ name, node }) => [name, snapshot(node)]);
          expect(captures(tree.rootNode)).toEqual(captures(fresh.rootNode));
        }
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        fresh.delete();
      }
      expression = next;
      source = updated;
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains existing variable-shaped parenthesized labels and optics expressions', () => {
  const expressions = [
    'view (#name) r',
    'user & (#name .~ "x")',
    '(#field %~ f)',
    '(#_field)',
    '(#привет)',
    '(#こんにちは)',
  ];
  const parser = new Parser().setLanguage(language);
  try {
    for (const expression of expressions) {
      const source = `value = ${expression}\nfollowing = 1\nafter = 2\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, expression).toBe(false);
        const label = /#[^ ).%]+/.exec(expression)![0];
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual([[label, source.indexOf(label), source.indexOf(label) + label.length]]);
        expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(0);
        expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
          'value',
          'following',
          'after',
        ]);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('keeps parenthesized labels after whitespace, comments and CPP through incremental edits', () => {
  const expressions = [
    '( #foo)',
    '({- comment -}#foo)',
    '( {- comment -}#Foo)',
    '({- outer {- inner -} -}#"quoted")',
    '(-- comment\n #Foo)',
    '(\n#if FLAG\n#Foo\n#endif\n)',
    '( #foo)',
  ];
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  let expression = expressions[0]!;
  let source = prefix + expression + suffix;
  let tree = parser.parse(source)!;
  try {
    for (const next of expressions) {
      const updated = prefix + next + suffix;
      tree.edit(
        new Edit({
          startIndex: prefix.length,
          oldEndIndex: prefix.length + expression.length,
          newEndIndex: prefix.length + next.length,
          startPosition: point(source, prefix.length),
          oldEndPosition: point(source, prefix.length + expression.length),
          newEndPosition: point(updated, prefix.length + next.length),
        })
      );
      const previous = tree;
      tree = parser.parse(updated, previous)!;
      previous.delete();
      const fresh = parser.parse(updated)!;
      try {
        expect(tree.rootNode.hasError, next).toBe(false);
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
        const labels = [...next.matchAll(/#(?:foo|Foo|"quoted")/g)];
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(
          labels.map((match) => [match[0], prefix.length + match.index, prefix.length + match.index + match[0].length])
        );
        expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(0);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
        for (const query of queries) {
          const captures = (node: Node): unknown =>
            query.captures(node).map(({ name, node }) => [name, snapshot(node)]);
          expect(captures(tree.rootNode)).toEqual(captures(fresh.rootNode));
        }
      } finally {
        fresh.delete();
      }
      expression = next;
      source = updated;
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('incrementally changes label spellings and repairs incomplete labels without stale ranges or captures', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  let spelling = '#foo';
  let source = prefix + spelling + suffix;
  let tree = parser.parse(source)!;
  try {
    for (const next of ['#Foo', '#3', '#""', '#"こんにちは"', String.raw`#"gap\ \"`, '#"gap\\\n\\"', '#...', '#foo']) {
      const updated = prefix + next + suffix;
      tree.edit(
        new Edit({
          startIndex: prefix.length,
          oldEndIndex: prefix.length + spelling.length,
          newEndIndex: prefix.length + next.length,
          startPosition: point(source, prefix.length),
          oldEndPosition: point(source, prefix.length + spelling.length),
          newEndPosition: point(updated, prefix.length + next.length),
        })
      );
      const previous = tree;
      tree = parser.parse(updated, previous)!;
      previous.delete();
      const fresh = parser.parse(updated)!;
      try {
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
        expect(tree.rootNode.hasError).toBe(next === '#...');
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(next === '#...' ? [] : [[next, prefix.length, prefix.length + next.length]]);
        for (const query of queries) {
          const captures = (node: Node): unknown =>
            query.captures(node).map(({ name, node }) => [name, snapshot(node)]);
          expect(captures(tree.rootNode)).toEqual(captures(fresh.rootNode));
        }
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        fresh.delete();
      }
      spelling = next;
      source = updated;
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

function point(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}

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
