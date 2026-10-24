import path from 'node:path';

import { Edit, Language, Parser } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..'))));
afterAll(() => parser.delete());

const contents = [
  '',
  'inline',
  '雪 😀',
  '\n  first\n  second\n  ',
  '"one" and ""two"" inside',
  String.raw`"\""" still inside`,
  String.raw`""\""" still inside`,
  String.raw`\"\"\"`,
  String.raw`\^A\n\123\o77\xFF\NUL\&`,
  '\\ \t\\gap',
  ...['\n', '\r\n', '\r', '\f'].flatMap((newline) => [
    `${newline}  first${newline}  second${newline}  `,
    `first\\${newline}  \\second`,
  ]),
];

test.each(contents)('retains one complete multiline string and following declarations: %j', (content) => {
  const literal = `"""${content}"""`;
  const tree = parser.parse(`value = ${literal}\nafter = "ordinary"\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([literal, '"ordinary"']);
    expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
      'value',
      'after',
    ]);
  } finally {
    tree.delete();
  }
});

test('stops each multiline literal at its first unescaped delimiter', () => {
  const tree = parser.parse('value = """first""" <> """second"""\nafter = "ordinary"\n')!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([
      '"""first"""',
      '"""second"""',
      '"ordinary"',
    ]);
  } finally {
    tree.delete();
  }
});

test.each([
  ['expression', 'value = ', '\nafter = "ordinary"\n'],
  ['constraint', 'value :: Proxy ', ' => Int\nvalue = undefined\n'],
])('reparses %s edits around escaped triple quotes consistently with a fresh parse', (_kind, prefix, suffix) => {
  let source = `${prefix}"""first\nsecond"""${suffix}`;
  let tree = parser.parse(source)!;
  try {
    for (const content of ['"', '""', String.raw`"\"""`, String.raw`""\""`, '\\ \\', '']) {
      const startIndex = source.indexOf('second');
      const endIndex = source.lastIndexOf('"""');
      const replacement = `second${content}`;
      const next = source.slice(0, startIndex) + replacement + source.slice(endIndex);
      tree.edit(
        new Edit({
          startIndex,
          oldEndIndex: endIndex,
          newEndIndex: startIndex + replacement.length,
          startPosition: { row: 1, column: 0 },
          oldEndPosition: { row: 1, column: endIndex - startIndex },
          newEndPosition: { row: 1, column: replacement.length },
        })
      );
      const incremental = parser.parse(next, tree)!;
      tree.delete();
      tree = incremental;
      const fresh = parser.parse(next)!;
      try {
        expect(incremental.rootNode.toString()).toBe(fresh.rootNode.toString());
        expect(incremental.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual(
          fresh.rootNode.descendantsOfType('string').map((node) => node.text)
        );
      } finally {
        fresh.delete();
      }
      source = next;
    }
  } finally {
    tree.delete();
  }
});

test.each([
  ' ',
  '\t',
  '\n',
  '\r\n',
  '\r',
  '\f',
  '\v',
  '\u0085',
  '\u00A0',
  '\u1680',
  '\u2000',
  '\u2007',
  '\u2028',
  '\u2029',
  '\u202F',
  '\u205F',
  '\u3000',
])('ends a multiline string after a %j gap before the closing delimiter', (whitespace) => {
  const literal = `"""first\\${whitespace}\\"""`;
  const tree = parser.parse(`value = ${literal}\nafter = """second"""\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([literal, '"""second"""']);
    expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
      'value',
      'after',
    ]);
  } finally {
    tree.delete();
  }
});

test.each([
  ['a " => b', false],
  ['a "b', true],
  ['a "" => b', false],
  [String.raw`a "\""" => b`, true],
  ['first\\ \\', true],
  ['first\\\n  \\', true],
] as const)('skips the complete type string %j when finding context arrows', (content, constrained) => {
  const literal = `"""${content}"""`;
  const tree = parser.parse(`value :: Proxy ${literal}${constrained ? ' => Int' : ''}\nvalue = undefined\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('signature')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('context')).toHaveLength(constrained ? 1 : 0);
    expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([literal]);
    expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
      'value',
    ]);
  } finally {
    tree.delete();
  }
});

test.each(['value = ', 'value :: Proxy '])(
  'retains the following binding after a malformed caret escape in %s',
  (prefix) => {
    const tree = parser.parse(`${prefix}"""a\\^"""\nafter = """second"""\n`)!;
    try {
      expect(
        tree.rootNode
          .descendantsOfType('bind')
          .filter((node) => node.childForFieldName('name')?.text === 'after')
          .map((node) => node.text)
      ).toEqual(['after = """second"""']);
      expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toContain('"""second"""');
      expect(tree.rootNode.descendantsOfType('string').some((node) => node.text.includes('after ='))).toBe(false);
    } finally {
      tree.delete();
    }
  }
);

test.each(['@', 'A', 'Z', '[', '\\', ']', '^', '_'])(
  'ends a type string after the valid caret control %j',
  (control) => {
    const literal = `"""a\\^${control}"""`;
    const tree = parser.parse(`value :: Proxy ${literal} => Int\nafter = """second"""\n`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('context')).toHaveLength(1);
      expect(tree.rootNode.descendantsOfType('string').map((node) => node.text)).toEqual([literal, '"""second"""']);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'after',
      ]);
    } finally {
      tree.delete();
    }
  }
);
