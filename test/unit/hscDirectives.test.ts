import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser, type Tree } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root, 'hsc'));

test('retains directive names, C body ranges, doubled hashes and following Haskell declarations', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/hscDirectives.hsc'), 'utf8');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const directives = tree.rootNode.descendantsOfType('hsc');
    expect(directives.map((node) => node.childForFieldName('name')?.text)).toEqual([
      'make_name',
      'make_constructor',
      'type',
      'size',
      'offset',
      'const',
      'const',
      'emit2',
      'const',
      'co\\\nnst',
      'const_str',
      'const',
      'const',
      'const',
      'emit_inline',
      'defineSuffix',
      'd',
      'call',
      'safety',
      'entity',
    ]);
    const bodies = directives.map((node) => node.childForFieldName('body')!);
    expect(bodies.map((node) => node.text)).toContain(String.raw` (HSC_VALUE /* } \" ' */ + 0)`);
    for (const node of directives) {
      expect(node.text.startsWith('#')).toBe(true);
      const name = node.childForFieldName('name')!;
      const body = node.childForFieldName('body')!;
      expect(source.slice(name.startIndex, name.endIndex)).toBe(name.text);
      expect(body.startIndex).toBe(name.endIndex);
      expect(source.slice(body.startIndex, body.endIndex)).toBe(body.text);
      expect(body.endIndex).toBeLessThanOrEqual(node.endIndex);
    }
    expect(tree.rootNode.descendantsOfType('integer').map((node) => node.text)).toContain('55##Int64');
    expect(tree.rootNode.descendantsOfType('label').map((node) => node.text)).toEqual([
      '##""',
      '##"nested label"',
      '##include',
      '##define',
      '##let',
    ]);
    expect(tree.rootNode.descendantsOfType('unboxed_tuple')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('starts directive and hash-literal ranges at their hash after any trivia', () => {
  const source = 'a = #const 42\nb = id    #{size int}\nc () =    #{const 42}##\nfollowing = 1\n';
  const parser = new Parser().setLanguage(language);
  const start = source.indexOf('    #{const');
  try {
    for (const replacement of ['    ', ' ', '\t  ']) {
      const variant = replace(source, start, 4, replacement);
      const tree = parseWithoutError(parser, variant);
      try {
        const nodes = tree.rootNode
          .descendantsOfType(['hsc', 'literal'])
          .filter((node) => node.descendantsOfType('hsc_args').length > 0);
        expect(nodes.map((node) => node.text)).toEqual(['#const 42', '#{size int}', '#{const 42}##']);
        for (const node of nodes) expect(variant[node.startIndex]).toBe('#');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('keeps arbitrary nested C arguments separate from Haskell layout', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const depth of [0, 32, 256]) {
      const source = `value = do\n  pure #{const ${'('.repeat(depth)}42${')'.repeat(depth)}}\nfollowing = 1\n`;
      const start = source.indexOf('42');
      for (const replacement of ['42', 'sizeof("}\\\"")', "(42 /* } ' */)"]) {
        const tree = parseWithoutError(parser, replace(source, start, 2, replacement));
        try {
          expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
        } finally {
          tree.delete();
        }
      }
    }
  } finally {
    parser.delete();
  }
});

for (const [fixture, target, replacements, names] of [
  [
    'hscHashOperators.hsc',
    '##+',
    ['##|+', '####+'],
    ['(##+)', '(##|+)', '(####+)', '(+##)', 'value', 'barValue', 'doubleValue', 'tailValue', 'following'],
  ],
  [
    'hscInlineConditionals.hsc',
    '#{else}',
    ['#{elif 0}', '#{else}\n'],
    ['value', 'nested', 'quoted', 'line', 'following'],
  ],
  [
    'hscCharacterBoundaries.hsc',
    String.raw`'\n'`,
    [String.raw`'\t'`, String.raw`'\''`],
    ['newline', 'quote', 'slash', 'named', 'control', 'following'],
  ],
  ['hscConditionalText.hsc', ':', ['⋆', ';'], ['colon', 'unicode', 'following']],
  ['hscWhitespaceBoundaries.hsc', '\r', ['\f', '\v'], ['textCR', 'textFF', 'argCR', 'argFF', 'commentFF', 'following']],
  [
    'hscCommentBoundaries.hsc',
    '⊕',
    [':', '⋆'],
    ['unicodeComment', 'colonComment', 'longComment', 'operator', 'following'],
  ],
] as const) {
  test(`retains ${fixture} boundaries and their variants`, () => {
    const parser = new Parser().setLanguage(language);
    const source = fs.readFileSync(path.join(root, 'test/fixtures', fixture), 'utf8');
    const tree = parseWithoutError(parser, source);
    const start = source.indexOf(target);
    try {
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual(
        names
      );
      if (fixture === 'hscWhitespaceBoundaries.hsc') {
        expect(tree.rootNode.descendantsOfType('hsc_args').map((node) => node.text.trim())).toEqual([
          '2\r+3',
          '4\f+5',
          '6 // ignored\f} +999',
        ]);
      }
      if (fixture === 'hscHashOperators.hsc') {
        expect(
          tree.rootNode
            .descendantsOfType('operator_chain')
            .flatMap((node) => node.childrenForFieldName('operator').map((operator) => operator.text))
        ).toEqual(['##+', '##|+', '####+', '+##']);
      }
      for (const replacement of replacements) {
        const variant = parseWithoutError(parser, replace(source, start, target.length, replacement));
        try {
          expect(
            variant.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)
          ).toEqual(names);
        } finally {
          variant.delete();
        }
      }
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

function replace(source: string, start: number, length: number, replacement: string): string {
  return source.slice(0, start) + replacement + source.slice(start + length);
}

function parseWithoutError(parser: Parser, source: string): Tree {
  const tree = parser.parse(source)!;
  expect(tree.rootNode.hasError, source).toBe(false);
  return tree;
}
