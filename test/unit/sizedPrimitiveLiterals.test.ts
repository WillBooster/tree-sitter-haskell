import fs from 'node:fs';
import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
await Parser.init();
const language = await Language.load(currentWasmPath(root));

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
  } finally {
    tree.delete();
    parser.delete();
  }
});

test('retains inline numeric alternatives and separators after explicit semicolons', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const literal of ['1', '1#Int8']) {
      for (const opener of ['case x of', String.raw`\case`, String.raw`\cases`]) {
        const source = `value = ${opener} ${literal} -> 2\nfollowing = 1\n`;
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
          expect(tree.rootNode.descendantsOfType('alternative')).toHaveLength(1);
          expect(tree.rootNode.descendantsOfType('integer')[0]?.text).toBe(literal);
          expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
        } finally {
          tree.delete();
        }
      }
      const source = `value = do\n  foo; ${literal}\n  2\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(tree.rootNode.descendantsOfType('do')[0]?.namedChildren.map((node) => node.text)).toEqual([
          'foo',
          literal,
          '2',
        ]);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('retains numeric constraint heads before the context arrow', () => {
  const parser = new Parser().setLanguage(language);
  const source = 'f :: 1 ~ n => Proxy n\nf = Proxy\nfollowing = 1\n';
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('context')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('context')[0]?.childForFieldName('context')?.text).toBe(' 1 ~ n');
    expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
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

test('retains following bindings after typed suffix and MagicHash literals', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const literal of ['55#Int64', '55#Int8', '55##', '0xff#Word8', '55#Int128', '55']) {
      const tree = parser.parse(`module X where\nvalue () = ${literal}\nfollowing = 1\nafter = 2\n`)!;
      try {
        expect(
          tree.rootNode
            .descendantsOfType('bind')
            .slice(-2)
            .map((node) => node.childForFieldName('name')?.text)
        ).toEqual(['following', 'after']);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
