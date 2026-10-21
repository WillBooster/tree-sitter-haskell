import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));
const queries = fs
  .readdirSync(path.join(root, 'queries'))
  .filter((file) => file.endsWith('.scm'))
  .map((file) => new Query(language, fs.readFileSync(path.join(root, 'queries', file), 'utf8')));
afterAll(() => {
  for (const query of queries) query.delete();
});

test('retains complete sized integer leaves at exact ranges in the compiler-checked fixture', () => {
  const source = fs.readFileSync(path.join(root, 'test/fixtures/sizedPrimitiveLiterals.hs'), 'utf8');
  const types = ['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'Word', 'Word8', 'Word16', 'Word32', 'Word64'];
  const expected = types.flatMap((type) => ['55', '0b11_0111', '0o67', '0x37'].map((number) => `${number}#${type}`));
  expected.push('55#Int8', '55#Word8', '0o_6_7#Int16', '0x_3_7#Word32', '1');
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const integers = tree.rootNode.descendantsOfType('integer');
    expect(integers.map((node) => node.text)).toEqual(expected);
    let offset = 0;
    for (const [index, text] of expected.entries()) {
      const start = source.indexOf(text, offset);
      expect(start).toBeGreaterThanOrEqual(offset);
      expect([integers[index]!.startIndex, integers[index]!.endIndex, integers[index]!.childCount]).toEqual([
        start,
        start + text.length,
        0,
      ]);
      offset = start + text.length;
    }
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
    for (const query of queries) expect(() => query.captures(tree.rootNode)).not.toThrow();
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('does not accept a valid type prefix inside an invalid longer primitive suffix', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const suffix of ['Int128', 'Word16x', "Int8'", 'Word64π', 'Foo', 'Int_8', 'Int0008', 'ŉnt32']) {
      const source = `value = 1#${suffix}\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.descendantsOfType('integer').map((node) => node.text)).toEqual(['1#', '1']);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
    const tree = parser.parse('value = 123')!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.endIndex).toBe(11);
      expect(tree.rootNode.descendantsOfType('integer').map((node) => node.text)).toEqual(['123']);
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
});

test('reparses typed suffix and MagicHash edits with fresh trees and captures', () => {
  const parser = new Parser().setLanguage(language);
  const prefix = 'module X where\nvalue () = ';
  const suffix = '\nfollowing = 1\nafter = 2\n';
  let literal = '55#Int64';
  const source = prefix + literal + suffix;
  let tree = parser.parse(source)!;
  const captures = (current: typeof tree): unknown =>
    queries.map((query) =>
      query.captures(current.rootNode).map(({ name, node }) => [name, node.type, node.startIndex, node.endIndex])
    );
  try {
    for (const next of ['55#Int8', '55##', '0xff#Word8', '55#Int128', '55#Int64', '55', '55#Int64']) {
      const updated = prefix + next + suffix;
      tree.edit(
        new Edit({
          startIndex: prefix.length,
          oldEndIndex: prefix.length + literal.length,
          newEndIndex: prefix.length + next.length,
          startPosition: { row: 1, column: 11 },
          oldEndPosition: { row: 1, column: 11 + literal.length },
          newEndPosition: { row: 1, column: 11 + next.length },
        })
      );
      const previous = tree;
      tree = parser.parse(updated, previous)!;
      previous.delete();
      const fresh = parser.parse(updated)!;
      try {
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
        expect(captures(tree)).toEqual(captures(fresh));
        expect(
          tree.rootNode
            .descendantsOfType('bind')
            .slice(-2)
            .map((node) => node.childForFieldName('name')?.text)
        ).toEqual(['following', 'after']);
      } finally {
        fresh.delete();
      }
      literal = next;
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

function snapshot(node: Node): unknown {
  return [
    node.type,
    node.isNamed,
    node.isMissing,
    node.isExtra,
    node.hasError,
    node.startIndex,
    node.endIndex,
    node.startPosition,
    node.endPosition,
    node.children.map((child, index) => [node.fieldNameForChild(index), snapshot(child)]),
  ];
}
