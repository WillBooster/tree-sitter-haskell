import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.resolve(import.meta.dirname, '../..');
const names = [
  '日本語',
  '한국어',
  ...[
    0x34_01, 0x4e_01, 0xac_01, 0x1_70_01, 0x1_8d_01, 0x2_00_01, 0x2_a7_01, 0x2_b7_41, 0x2_b8_21, 0x2_ce_b1, 0x2_eb_f1,
    0x3_00_01, 0x3_13_51,
  ].map((codepoint) => String.fromCodePoint(codepoint)),
];
await Parser.init();
const language = await Language.load(currentWasmPath(root));

test('recognizes Unicode range interiors in record fields, selectors, and qualified variables', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const name of names) {
      const source = `value = record.${name}\nselector = (.${name})\nqualified = Demo.${name}\nfollowing = 1\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(
          tree.rootNode.descendantsOfType('projection').map((node) => node.text),
          source
        ).toEqual([`record.${name}`]);
        expect(tree.rootNode.descendantsOfType('projection_selector').map((node) => node.text)).toEqual([`(.${name})`]);
        expect(tree.rootNode.descendantsOfType('qualified').map((node) => node.text)).toEqual([`Demo.${name}`]);
        const field = tree.rootNode.descendantsOfType('projection')[0]!.childForFieldName('field')!;
        expect(field.text).toBe(name);
        expect(field.startIndex).toBe(source.indexOf(name));
        expect(field.endIndex).toBe(source.indexOf(name) + name.length);
        expect(tree.rootNode.descendantsOfType('bind').at(-1)?.childForFieldName('name')?.text).toBe('following');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
