import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node, type Tree } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

interface ParseState {
  source: string;
  tree: Tree;
}

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root, 'hsc'));
const queries = ['queries', 'hsc/queries'].flatMap((directory) =>
  fs
    .readdirSync(path.join(root, directory))
    .filter((file) => file.endsWith('.scm'))
    .map((file) => new Query(language, fs.readFileSync(path.join(root, directory, file), 'utf8')))
);
afterAll(() => {
  for (const query of queries) query.delete();
});

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
    const injected = queries
      .flatMap((query) => query.captures(tree.rootNode))
      .filter(({ name, node }) => name === 'injection.content' && node.type === 'hsc_args');
    expect(injected.map(({ node }) => [node.startIndex, node.endIndex])).toEqual(
      bodies.map((node) => [node.startIndex, node.endIndex])
    );
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('starts directive and hash-literal ranges at their hash through trivia edits and undo', () => {
  const source = 'a = #const 42\nb = id    #{size int}\nc () =    #{const 42}##\nfollowing = 1\n';
  const parser = new Parser().setLanguage(language);
  const state = { source, tree: parser.parse(source)! };
  const start = source.indexOf('    #{const');
  let length = 4;
  try {
    for (const replacement of ['    ', ' ', '\t  ', '    ']) {
      replaceAndCompare(parser, state, start, length, replacement);
      const nodes = state.tree.rootNode
        .descendantsOfType(['hsc', 'literal'])
        .filter((node) => node.descendantsOfType('hsc_args').length > 0);
      expect(nodes.map((node) => node.text)).toEqual(['#const 42', '#{size int}', '#{const 42}##']);
      for (const node of nodes) expect(state.source[node.startIndex]).toBe('#');
      length = replacement.length;
    }
    expect(state.source).toBe(source);
  } finally {
    state.tree.delete();
    parser.delete();
  }
});

test('keeps arbitrary nested C arguments separate from Haskell layout through edits and undo', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const depth of [0, 32, 256]) {
      const source = `value = do\n  pure #{const ${'('.repeat(depth)}42${')'.repeat(depth)}}\nfollowing = 1\n`;
      const state = { source, tree: parser.parse(source)! };
      const start = source.indexOf('42');
      let length = 2;
      try {
        for (const replacement of ['42', 'sizeof("}\\\"")', "(42 /* } ' */)", '42']) {
          replaceAndCompare(parser, state, start, length, replacement);
          expect(state.tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe(
            'following'
          );
          length = replacement.length;
        }
        expect(state.source).toBe(source);
      } finally {
        state.tree.delete();
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
    ['##|+', '####+', '##+'],
    ['(##+)', '(##|+)', '(####+)', '(+##)', 'value', 'barValue', 'doubleValue', 'tailValue', 'following'],
  ],
  [
    'hscInlineConditionals.hsc',
    '#{else}',
    ['#{elif 0}', '#{else}\n', '#{else}'],
    ['value', 'nested', 'quoted', 'line', 'following'],
  ],
  [
    'hscCharacterBoundaries.hsc',
    String.raw`'\n'`,
    [String.raw`'\t'`, String.raw`'\''`, String.raw`'\n'`],
    ['newline', 'quote', 'slash', 'named', 'control', 'following'],
  ],
  ['hscConditionalText.hsc', ':', ['⋆', ';', ':'], ['colon', 'unicode', 'following']],
  [
    'hscWhitespaceBoundaries.hsc',
    '\r',
    ['\f', '\v', '\r'],
    ['textCR', 'textFF', 'argCR', 'argFF', 'commentFF', 'following'],
  ],
  [
    'hscCommentBoundaries.hsc',
    '⊕',
    [':', '⋆', '⊕'],
    ['unicodeComment', 'colonComment', 'longComment', 'operator', 'following'],
  ],
] as const) {
  test(`retains ${fixture} boundaries through edits and undo`, () => {
    const parser = new Parser().setLanguage(language);
    const source = fs.readFileSync(path.join(root, 'test/fixtures', fixture), 'utf8');
    const state = { source, tree: parser.parse(source)! };
    const start = source.indexOf(target);
    let length = target.length;
    try {
      expect(state.tree.rootNode.hasError).toBe(false);
      expect(state.tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual(
        names
      );
      if (fixture === 'hscWhitespaceBoundaries.hsc') {
        expect(state.tree.rootNode.descendantsOfType('hsc_args').map((node) => node.text.trim())).toEqual([
          '2\r+3',
          '4\f+5',
          '6 // ignored\f} +999',
        ]);
      }
      if (fixture === 'hscHashOperators.hsc') {
        expect(
          state.tree.rootNode
            .descendantsOfType('operator_chain')
            .flatMap((node) => node.childrenForFieldName('operator').map((operator) => operator.text))
        ).toEqual(['##+', '##|+', '####+', '+##']);
      }
      for (const replacement of replacements) {
        replaceAndCompare(parser, state, start, length, replacement);
        expect(
          state.tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)
        ).toEqual(names);
        length = replacement.length;
      }
      expect(state.source).toBe(source);
    } finally {
      state.tree.delete();
      parser.delete();
    }
  });
}

function replaceAndCompare(
  parser: Parser,
  state: ParseState,
  start: number,
  length: number,
  replacement: string
): void {
  const startPosition = positionAt(state.source, start);
  const oldEndPosition = positionAt(state.source, start + length);
  state.source = state.source.slice(0, start) + replacement + state.source.slice(start + length);
  state.tree.edit(
    new Edit({
      startIndex: start,
      oldEndIndex: start + length,
      newEndIndex: start + replacement.length,
      startPosition,
      oldEndPosition,
      newEndPosition: positionAt(state.source, start + replacement.length),
    })
  );
  const previous = state.tree;
  state.tree = parser.parse(state.source, previous)!;
  previous.delete();
  const fresh = parser.parse(state.source)!;
  try {
    expect(state.tree.rootNode.hasError).toBe(false);
    expect(metadata(state.tree.rootNode)).toEqual(metadata(fresh.rootNode));
    for (const query of queries) expect(captures(query, state.tree.rootNode)).toEqual(captures(query, fresh.rootNode));
  } finally {
    fresh.delete();
  }
}

function positionAt(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}

function captures(query: Query, node: Node): (string | number)[][] {
  return query.captures(node).map(({ name, node: value }) => [name, value.type, value.startIndex, value.endIndex]);
}

function metadata(node: Node): unknown {
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
    node.childCount,
    node.children.map((child, index) => [node.fieldNameForChild(index), metadata(child)]),
  ];
}
