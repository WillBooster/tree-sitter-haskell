import fs from 'node:fs';
import path from 'node:path';
import { Edit, Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const language = await Language.load(currentWasmPath(path.join(import.meta.dirname, '../..')));
const tagsText = fs.readFileSync(path.join(import.meta.dirname, '../../queries/tags.scm'), 'utf8');
const localsText = fs.readFileSync(path.join(import.meta.dirname, '../../queries/locals.scm'), 'utf8');

test('indexes deeply grouped simple bindings while retaining local definitions and pattern exclusions', () => {
  const parser = new Parser().setLanguage(language);
  const tags = new Query(language, tagsText);
  const locals = new Query(language, localsText);
  try {
    for (const depth of [1, 2, 10, 50]) {
      const grouped = `${'('.repeat(depth)}named${')'.repeat(depth)}`;
      const source = `${grouped} = 1\nresult = let ${grouped} = 2 in named\n(left, right) = undefined\nfollowing = 3\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        const names = tags
          .matches(tree.rootNode)
          .flatMap(({ captures }) => captures.filter(({ name }) => name === 'name'));
        expect(
          names.filter(({ node }) => node.text === 'named').map(({ node }) => node.startIndex),
          source
        ).toEqual([depth]);
        expect(
          names.some(({ node }) => ['left', 'right'].includes(node.text)),
          source
        ).toBe(false);
        const captures = locals.captures(tree.rootNode).filter(({ node }) => node.text === 'named');
        expect(
          captures.map(({ name }) => name),
          source
        ).toEqual(['local.definition', 'local.definition', 'local.reference']);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text, source).toBe('following = 3');
      } finally {
        tree.delete();
      }
    }
  } finally {
    tags.delete();
    locals.delete();
    parser.delete();
  }
});

test('incrementally wraps a simple binding without changing its definition location or the following declaration', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(language, tagsText);
  const previous = parser.parse('named = 1\nfollowing = 2\n')!;
  try {
    previous.edit(
      new Edit({
        startIndex: 0,
        oldEndIndex: 5,
        newEndIndex: 9,
        startPosition: { row: 0, column: 0 },
        oldEndPosition: { row: 0, column: 5 },
        newEndPosition: { row: 0, column: 9 },
      })
    );
    const source = '((named)) = 1\nfollowing = 2\n';
    const incremental = parser.parse(source, previous)!;
    const fresh = parser.parse(source)!;
    try {
      expect(incremental.rootNode.hasError).toBe(false);
      expect(incremental.rootNode.toString()).toBe(fresh.rootNode.toString());
      expect(
        query
          .captures(incremental.rootNode)
          .filter(({ name, node }) => name === 'name' && node.text === 'named')
          .map(({ node }) => [node.startIndex, node.endIndex])
      ).toEqual([[2, 7]]);
      expect(incremental.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following = 2');
    } finally {
      incremental.delete();
      fresh.delete();
    }
  } finally {
    previous.delete();
    query.delete();
    parser.delete();
  }
});

test('retains binding definitions through the existing constructor-synonym alias without indexing them as declarations', () => {
  const parser = new Parser().setLanguage(language);
  const locals = new Query(language, localsText);
  const tags = new Query(language, tagsText);
  const source = 'pattern P <- Just a where ((build)) = Just a\nfollowing = 1\n';
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(
      locals
        .captures(tree.rootNode)
        .filter(({ node }) => node.text === 'build')
        .map(({ name, node }) => [name, node.startIndex, node.endIndex])
    ).toEqual([['local.definition', source.indexOf('build'), source.indexOf('build') + 'build'.length]]);
    expect(tags.captures(tree.rootNode).some(({ name, node }) => name === 'name' && node.text === 'build')).toBe(false);
  } finally {
    tree.delete();
    tags.delete();
    locals.delete();
    parser.delete();
  }
});
