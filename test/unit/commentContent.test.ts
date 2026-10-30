import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const resources = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (name) => {
    const language = await Language.load(currentWasmPath(root, name));
    return { name, language };
  })
);

for (const { name, language } of resources) {
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
            const start = source.indexOf(comment) + comment.length - body.length - (comment.startsWith('{-') ? 2 : 0);
            expect([content[0]!.startIndex, content[0]!.endIndex]).toEqual([start, start + body!.length]);
            expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual(
              prefix.includes('value') ? ['before', 'value', 'following'] : ['before', 'following']
            );
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
    ] as const)(`${name} parses either %s at depth ${depth}`, (_label, target, replacement) => {
      const parser = new Parser().setLanguage(language);
      const original = `before = 0\nvalue = (${'let { x = ('.repeat(depth)}{-  outer {- nested -} tail -} 0${') } in x'.repeat(depth)})\n-- | Docs\r\n\t-- continued\r\nfollowing = 1\n`;
      const start = original.indexOf(target);
      expect(start).toBeGreaterThanOrEqual(0);
      try {
        for (const source of [
          original,
          original.slice(0, start) + replacement + original.slice(start + target.length),
        ]) {
          const tree = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError).toBe(false);
            expect(
              tree.rootNode
                .childForFieldName('declarations')!
                .namedChildren.filter((node) => node.type === 'bind')
                .map((node) => node.childForFieldName('name')?.text)
            ).toEqual(['before', 'value', source.includes('afterwards') ? 'afterwards' : 'following']);
          } finally {
            tree.delete();
          }
        }
      } finally {
        parser.delete();
      }
    });
  }
}
