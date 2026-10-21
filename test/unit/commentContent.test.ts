import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const resources = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (name) => {
    const language = await Language.load(currentWasmPath(root, name));
    const directories = name === 'hsc' ? ['queries', 'hsc/queries'] : ['queries'];
    const queries = directories.flatMap((directory) =>
      fs
        .readdirSync(path.join(root, directory))
        .filter((file) => file.endsWith('.scm'))
        .map((file) => new Query(language, fs.readFileSync(path.join(root, directory, file), 'utf8')))
    );
    const injections = new Query(language, fs.readFileSync(path.join(root, 'queries/injections.scm'), 'utf8'));
    const highlights = queries.find((query) => query.captureNames.includes('comment.documentation'))!;
    return { name, language, queries, injections, highlights };
  })
);
afterAll(() => {
  for (const { queries, injections } of resources) {
    for (const query of queries) query.delete();
    injections.delete();
  }
});

for (const { name, language, queries, injections, highlights } of resources) {
  test(`${name} exposes exact comment bodies without losing whitespace, nesting or following bindings`, () => {
    const examples = [
      ['{-  body  -}', 'comment', '  body  '],
      ['{--}', 'comment', ''],
      ['{---}', 'comment', '-'],
      ['{- outer {- nested -} tail -}', 'comment', ' outer {- nested -} tail '],
      ['--  body  ', 'comment', '  body  '],
      ['--', 'comment', ''],
      ['-- |  body  ', 'haddock', '  body  '],
      ['-- ||body', 'haddock', '|body'],
      ['-- ^', 'haddock', ''],
      ['{- ^  body  -}', 'haddock', '  body  '],
      ['{- ||body-}', 'haddock', '|body'],
      ['-- | Docs\r\n\t-- continued', 'haddock', ' Docs\r\n\t-- continued'],
      ['-- first\n-- second', 'comment', ' first\n-- second'],
    ] as const;
    const parser = new Parser().setLanguage(language);
    try {
      for (const prefix of ['before = 0\n', 'before = 0\n  ', 'before = 0\nvalue = 0   ']) {
        for (const [comment, kind, body] of examples) {
          const source = `${prefix}${comment}\nfollowing = 1\n`;
          const tree = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError, comment).toBe(false);
            const nodes = tree.rootNode.descendantsOfType(['comment', 'haddock']);
            expect(nodes.map((node) => [node.type, node.text])).toEqual([[kind, comment]]);
            const content = nodes[0]!.namedChildren;
            expect(content.map((node) => [node.type, node.text])).toEqual([['content', body]]);
            expect(
              highlights
                .captures(tree.rootNode)
                .filter(
                  ({ name, node }) =>
                    name !== 'spell' && node.startIndex >= nodes[0]!.startIndex && node.endIndex <= nodes[0]!.endIndex
                )
                .map(({ name, node }) => [name, node.text, node.startIndex, node.endIndex])
            ).toEqual([
              [
                kind === 'haddock' ? 'comment.documentation' : 'comment',
                comment,
                source.indexOf(comment),
                source.indexOf(comment) + comment.length,
              ],
            ]);
            const start = source.indexOf(comment) + comment.length - body.length - (comment.startsWith('{-') ? 2 : 0);
            expect([content[0]!.startIndex, content[0]!.endIndex]).toEqual([start, start + body!.length]);
            expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual(
              prefix.includes('value') ? ['before', 'value', 'following'] : ['before', 'following']
            );
            expect(
              injections
                .captures(tree.rootNode)
                .filter((capture) => capture.name === 'injection.content')
                .map(({ node }) => [node.type, node.text, node.startIndex, node.endIndex])
            ).toEqual(kind === 'comment' ? [['content', body, start, start + body!.length]] : []);
          } finally {
            tree.delete();
          }
        }
      }
    } finally {
      parser.delete();
    }
  });

  test(`${name} keeps Haskell operators distinct from comment markers`, () => {
    const parser = new Parser().setLanguage(language);
    try {
      for (const operator of ['---+', '--|', '--^', '--⊕', '------>']) {
        const tree = parser.parse(`value = a ${operator} b\nfollowing = 1\n`)!;
        try {
          expect(tree.rootNode.hasError).toBe(false);
          expect(tree.rootNode.descendantsOfType(['comment', 'haddock'])).toHaveLength(0);
          expect(tree.rootNode.descendantsOfType('operator').map((node) => node.text)).toEqual([operator]);
        } finally {
          tree.delete();
        }
      }
      for (const operator of ['--|', '--+', '--⊕']) {
        const tree = parser.parse(operator)!;
        try {
          expect(tree.rootNode.hasError).toBe(true);
          expect(tree.rootNode.descendantsOfType(['comment', 'haddock'])).toHaveLength(0);
        } finally {
          tree.delete();
        }
      }
      const hash = name === 'hsc' ? '##' : '#';
      const source = `-- | Docs\ndata Flag = Off | On\nguarded x | x > 0 = [y | y <- [x]]\nunboxed = (${hash} 1 | ${hash})\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(
          highlights
            .captures(tree.rootNode)
            .filter(({ name, node }) => name === 'operator' && node.text === '|')
            .map(({ node }) => [node.startIndex, node.endIndex])
        ).toEqual(['| On', '| x', '| y', '| #'].map((marker) => [source.indexOf(marker), source.indexOf(marker) + 1]));
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });

  test(`${name} terminates empty EOF bodies and retains unfinished block content for recovery`, () => {
    const parser = new Parser().setLanguage(language);
    try {
      for (const [source, body, error] of [
        ['--', '', false],
        ['-- |', '', false],
        ['{--}', '', false],
        ['{-|-}', '', false],
        ['{- unfinished', ' unfinished', true],
      ] as const) {
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError).toBe(error);
          expect(tree.rootNode.descendantsOfType('content').map((node) => node.text)).toEqual([body]);
        } finally {
          tree.delete();
        }
      }
    } finally {
      parser.delete();
    }
  });

  for (const depth of [0, 32, 256]) {
    test.each([
      ['nesting', 'nested', '{- nested -}'],
      ['body whitespace', '  outer', '\t outer'],
      ['doubled herald', '-- | Docs', '-- ||Docs'],
      ['line ending', '\r\n\t-- continued', '\n  -- continued'],
      ['documentation marker', '{-  outer', '{- | outer'],
      ['following binding', 'following', 'afterwards'],
    ] as const)(`${name} restores %s at depth ${depth} through an edit and undo`, (_label, target, replacement) => {
      const parser = new Parser().setLanguage(language);
      let source = `before = 0\nvalue = (${'let { x = ('.repeat(depth)}{-  outer {- nested -} tail -} 0${') } in x'.repeat(depth)})\n-- | Docs\r\n\t-- continued\r\nfollowing = 1\n`;
      let tree = parser.parse(source)!;
      try {
        const original = source;
        for (const [from, to] of [
          [target, replacement],
          [replacement, target],
        ] as const) {
          const start = source.indexOf(from);
          expect(start).toBeGreaterThanOrEqual(0);
          const oldSource = source;
          source = source.slice(0, start) + to + source.slice(start + from.length);
          tree.edit(
            new Edit({
              startIndex: start,
              oldEndIndex: start + from.length,
              newEndIndex: start + to.length,
              startPosition: positionAt(oldSource, start),
              oldEndPosition: positionAt(oldSource, start + from.length),
              newEndPosition: positionAt(source, start + to.length),
            })
          );
          const previous = tree;
          tree = parser.parse(source, previous)!;
          previous.delete();
          const fresh = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError).toBe(false);
            expect(metadata(tree.rootNode)).toEqual(metadata(fresh.rootNode));
            for (const query of queries)
              expect(captures(query, tree.rootNode)).toEqual(captures(query, fresh.rootNode));
            expect(
              tree.rootNode
                .childForFieldName('declarations')!
                .namedChildren.filter((node) => node.type === 'bind')
                .map((node) => node.childForFieldName('name')?.text)
            ).toEqual(['before', 'value', source.includes('afterwards') ? 'afterwards' : 'following']);
          } finally {
            fresh.delete();
          }
        }
        expect(source).toBe(original);
      } finally {
        tree.delete();
        parser.delete();
      }
    });
  }
}

function positionAt(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
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
    node.children.map((child, index) => [node.fieldNameForChild(index), metadata(child)]),
  ];
}

function captures(query: Query, node: Node): (string | number)[][] {
  return query.captures(node).map(({ name, node: value }) => [name, value.type, value.startIndex, value.endIndex]);
}
