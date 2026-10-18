import { afterAll, expect, test } from 'vitest';
import path from 'node:path';

import { Edit, Language, Parser } from '@willbooster/web-tree-sitter';

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

test('reparses edits around escaped triple quotes consistently with a fresh parse', () => {
  let source = 'value = """first\nsecond"""\nafter = "ordinary"\n';
  let tree = parser.parse(source)!;
  try {
    for (const content of ['"', '""', String.raw`"\"""`, String.raw`""\""`, '']) {
      const startIndex = source.indexOf('second');
      const endIndex = source.lastIndexOf('"""\nafter');
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
