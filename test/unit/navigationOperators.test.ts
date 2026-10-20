import fs from 'node:fs';
import path from 'node:path';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));
const tags = fs.readFileSync(path.join(import.meta.dirname, '../../queries/tags.scm'), 'utf8');

let tagQuery: Query;
let highlightQuery: Query;
beforeAll(() => {
  tagQuery = new Query(language, tags);
  highlightQuery = new Query(
    language,
    fs.readFileSync(path.join(import.meta.dirname, '../../queries/highlights.scm'), 'utf8')
  );
}, 180_000);
afterAll(() => {
  tagQuery.delete();
  highlightQuery.delete();
});

test('preserves subtraction after grouped names instead of applying them to negative arguments', () => {
  const parser = new Parser().setLanguage(language);
  const query = tagQuery;
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
        expect(declaration?.childForFieldName('match')?.childForFieldName('expression')?.type, source).toBe('infix');
        const calls = query
          .matches(tree.rootNode)
          .filter(({ captures }) => captures.some(({ name }) => name === 'reference.call'));
        expect(
          calls.flatMap(({ captures }) => captures.filter(({ name }) => name === 'name').map(({ node }) => node.text)),
          source
        ).toEqual(['-']);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('normalizes grouped name expressions while reserving call tags and highlights for function position', () => {
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
    const callStart = source.indexOf('(((f)))', source.indexOf('called')) + 3;
    const calls = tagQuery
      .matches(tree.rootNode)
      .filter(({ captures }) => captures.some(({ name }) => name === 'reference.call'));
    expect(
      calls.flatMap(({ captures }) =>
        captures.filter(({ name }) => name === 'name').map(({ node }) => [node.text, node.startIndex])
      )
    ).toEqual([['f', callStart]]);
    expect(
      highlightQuery
        .captures(tree.rootNode)
        .filter(({ name, node }) => name === 'function.call' && node.text === 'f')
        .map(({ node }) => node.startIndex)
    ).toEqual([callStart]);
    expect(tree.rootNode.descendantsOfType('negation').map((node) => node.text)).toEqual(['-x']);
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains left-associative application when grouped names occupy argument positions', () => {
  const parser = new Parser().setLanguage(language);
  const query = tagQuery;
  const highlights = highlightQuery;
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
        const calls = query
          .matches(tree.rootNode)
          .filter(({ captures }) => captures.some(({ name }) => name === 'reference.call'));
        expect(
          calls.flatMap(({ captures }) => captures.filter(({ name }) => name === 'name').map(({ node }) => node.text)),
          source
        ).toEqual([callee]);
        const callHighlights = highlights.captures(tree.rootNode).filter(({ name }) => name === 'function.call');
        expect(
          callHighlights.some(({ node }) => node.text === callee),
          source
        ).toBe(true);
        const argumentStart = source.indexOf(grouped);
        expect(
          callHighlights.filter(
            ({ node }) => node.startIndex >= argumentStart && node.endIndex <= argumentStart + grouped.length
          ),
          source
        ).toEqual([]);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 1');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
