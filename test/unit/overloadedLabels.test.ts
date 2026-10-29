import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));

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

test('preserves unboxed and label roles across spellings and physical adjacency', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\nafter = 2\n';
  const examples = [
    { expression: '(# left, right #)', labels: [], unboxed: true },
    { expression: '(#Bar, right #)', labels: [], unboxed: true },
    { expression: '(#1, right #)', labels: [], unboxed: true },
    { expression: '(#"a", right #)', labels: [], unboxed: true },
    { expression: "(#'c', right #)", labels: [], unboxed: true },
    { expression: '(##Foo, right #)', labels: ['#Foo'], unboxed: true },
    { expression: '(#Foo)', labels: ['#Foo'], unboxed: false },
    { expression: '(#É)', labels: ['#É'], unboxed: false },
    { expression: '(#ǅ)', labels: ['#ǅ'], unboxed: false },
    { expression: '(#1)', labels: ['#1'], unboxed: false },
    { expression: "(#'x')", labels: ["#'x'"], unboxed: false },
    { expression: '(#"x")', labels: ['#"x"'], unboxed: false },
    { expression: '(#Foo {- outer {- inner -} -})', labels: ['#Foo'], unboxed: false },
    { expression: '(#Foo -- comment\n)', labels: ['#Foo'], unboxed: false },
    { expression: '(#Foo\n)', labels: ['#Foo'], unboxed: false },
    { expression: String.raw`(#"escaped\"text")`, labels: [String.raw`#"escaped\"text"`], unboxed: false },
    { expression: String.raw`(#"control\^\")`, labels: [String.raw`#"control\^\"`], unboxed: false },
    { expression: '(#"gap\\\n \\text")', labels: ['#"gap\\\n \\text"'], unboxed: false },
    { expression: '( #Foo)', labels: ['#Foo'], unboxed: false },
    { expression: '({- comment -}#Foo)', labels: ['#Foo'], unboxed: false },
  ];
  try {
    for (const { expression, labels, unboxed } of examples) {
      const source = prefix + expression + suffix;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, expression).toBe(false);
        expect(tree.rootNode.descendantsOfType('unboxed_tuple').map((node) => node.text)).toEqual(
          unboxed ? [expression] : []
        );
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(labels.map((label) => [label, source.indexOf(label), source.indexOf(label) + label.length]));
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

test('keeps parenthesized labels after whitespace, comments and CPP', () => {
  const expressions = [
    '( #foo)',
    '({- comment -}#foo)',
    '( {- comment -}#Foo)',
    '({- outer {- inner -} -}#"quoted")',
    '(-- comment\n #Foo)',
    '(\n#if FLAG\n#Foo\n#endif\n)',
  ];
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  try {
    for (const expression of expressions) {
      const tree = parser.parse(prefix + expression + suffix)!;
      try {
        expect(tree.rootNode.hasError, expression).toBe(false);
        const labels = [...expression.matchAll(/#(?:foo|Foo|"quoted")/g)];
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(
          labels.map((match) => [match[0], prefix.length + match.index, prefix.length + match.index + match[0].length])
        );
        expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(0);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('keeps label spellings at exact ranges and rejects incomplete labels', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'value = ',
    suffix = '\nfollowing = 1\n';
  try {
    for (const spelling of [
      '#foo',
      '#Foo',
      '#3',
      '#""',
      '#"こんにちは"',
      String.raw`#"gap\ \"`,
      '#"gap\\\n\\"',
      '#...',
    ]) {
      const tree = parser.parse(prefix + spelling + suffix)!;
      try {
        expect(tree.rootNode.hasError).toBe(spelling === '#...');
        expect(
          tree.rootNode.descendantsOfType('label').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(spelling === '#...' ? [] : [[spelling, prefix.length, prefix.length + spelling.length]]);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
