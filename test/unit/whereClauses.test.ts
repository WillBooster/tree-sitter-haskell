import path from 'node:path';

import { Language, type Node, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
interface ClauseVariant {
  before: string;
  after: string;
  clauses: string[];
  bodyDeclarations?: (string[] | undefined)[];
}
interface Fixture {
  name: string;
  source: string;
  clauses: string[];
  bodyDeclarations?: (string[] | undefined)[];
  variants?: ClauseVariant[];
}
const fixtures: Fixture[] = [
  {
    name: 'multiline binding',
    source: 'outer = local\n  where\n    local = 1\nfollowing = 2\n',
    clauses: ['where\n    local = 1'],
  },
  {
    name: 'function bindings',
    source: 'outer value = local value\n  where\n    local item = item + 1\nfollowing = 2\n',
    clauses: ['where\n    local item = item + 1'],
  },
  {
    name: 'comments around the keyword',
    source: 'outer = local\n  -- before where\n  where -- local definitions\n    local = 1\nfollowing = 2\n',
    clauses: ['where -- local definitions\n    local = 1'],
  },
  {
    name: 'inline explicit bindings',
    source: 'outer = local where { local = 1; other = 2 }\nfollowing = 2\n',
    clauses: ['where { local = 1; other = 2 }'],
  },
  {
    name: 'nested bindings',
    source: 'outer = local\n  where\n    local = inner\n      where\n        inner = 1\nfollowing = 2\n',
    clauses: ['where\n    local = inner\n      where\n        inner = 1', 'where\n        inner = 1'],
  },
  {
    name: 'case alternative',
    source: 'outer value = case value of\n  item -> local\n    where\n      local = 1\nfollowing = 2\n',
    clauses: ['where\n      local = 1'],
  },
  {
    name: 'lambda-cases alternative',
    source: 'outer = \\cases\n  item -> local\n    where\n      local = 1\nfollowing = 2\n',
    clauses: ['where\n      local = 1'],
  },
  {
    name: 'empty explicit bindings',
    source: 'outer = 1 where {}\nfollowing = 2\n',
    clauses: ['where {}'],
    bodyDeclarations: [[]],
    variants: [
      {
        before: '{}',
        after: '{ local = 3 }',
        clauses: ['where { local = 3 }'],
        bodyDeclarations: [['local = 3']],
      },
    ],
  },
  {
    name: 'empty implicit bindings',
    source: 'outer = 1 where\nfollowing = 2\n',
    clauses: ['where'],
    bodyDeclarations: [undefined],
    variants: [
      {
        before: 'where',
        after: 'where\n  local = 3',
        clauses: ['where\n  local = 3'],
        bodyDeclarations: [['local = 3']],
      },
    ],
  },
];

await Parser.init();
const languages = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (dialect) => ({
    dialect,
    language: await Language.load(currentWasmPath(root, dialect)),
  }))
);

test.each(languages.flatMap((language) => fixtures.map((fixture) => ({ ...fixture, ...language }))))(
  '$dialect exposes $name and its variants as selectable where clauses',
  ({ language, source, clauses, bodyDeclarations, variants = [] }) => {
    const parser = new Parser().setLanguage(language);
    try {
      const replaced = [
        { before: '1', after: '22', clauses: clauses.map((text) => text.replace('1', '22')), bodyDeclarations },
        ...variants,
      ].map(({ before, after, ...expected }) => {
        const startIndex = source.indexOf(before);
        expect(startIndex).toBeGreaterThanOrEqual(0);
        return { source: source.slice(0, startIndex) + after + source.slice(startIndex + before.length), ...expected };
      });
      for (const variant of [{ source, clauses, bodyDeclarations }, ...replaced]) {
        const tree = parser.parse(variant.source)!;
        try {
          expectClauses(tree.rootNode, variant.source, variant.clauses, variant.bodyDeclarations);
        } finally {
          tree.delete();
        }
      }
    } finally {
      parser.delete();
    }
  }
);

function expectClauses(
  rootNode: Node,
  source: string,
  expected: string[],
  bodyDeclarations?: (string[] | undefined)[]
): void {
  expect(rootNode.hasError).toBe(false);
  const clauses = rootNode.descendantsOfType('where_clause');
  expect(clauses.map((node) => node.text)).toEqual(expected);
  for (const [index, clause] of clauses.entries()) {
    expect(clause.parent?.childForFieldName('binds')?.type).toBe('where_clause');
    expect(rootNode.namedDescendantForIndex(clause.startIndex, clause.startIndex + 1)?.type).toBe('where_clause');
    const body = clause.childForFieldName('binds');
    if (body) expect(body.type).toBe('local_binds');
    if (bodyDeclarations) {
      expect(body?.childrenForFieldName('decl').map((node) => node.text)).toEqual(bodyDeclarations[index]);
    }
    expect(clause.startPosition).toEqual(position(source, clause.startIndex));
    expect(clause.endPosition).toEqual(position(source, clause.endIndex));
  }
  const withBodies = clauses.filter((clause) => clause.childForFieldName('binds'));
  expect(captureWhereBodies(rootNode)).toEqual(withBodies.map((clause) => [clause.startIndex, clause.endIndex]));
  const following = rootNode.childForFieldName('declarations')?.lastNamedChild;
  expect(following?.text).toBe('following = 2');
  expect(following?.startPosition).toEqual(position(source, source.indexOf('following')));
}

function captureWhereBodies(rootNode: Node): (readonly [number, number])[] {
  const captured: (readonly [number, number])[] = [];
  const pending: Node[] = [rootNode];
  while (pending.length > 0) {
    const node = pending.pop()!;
    const children = node.children.filter((child) => !child.isExtra);
    for (let index = 0; index + 1 < children.length; index++) {
      const keyword = children[index]!;
      const body = children[index + 1]!;
      if (!keyword.isNamed && keyword.type === 'where' && body.isNamed && body.type === 'local_binds') {
        captured.push([keyword.startIndex, body.endIndex]);
      }
    }
    pending.push(...node.children);
  }
  return captured.toSorted(([a], [b]) => a - b);
}

function position(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}
