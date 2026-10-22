import path from 'node:path';
import { Edit, Language, Parser, Query, type Node } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';
import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
interface ClauseEdit {
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
  edits?: ClauseEdit[];
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
    edits: [
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
    edits: [
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
  '$dialect exposes $name as selectable where clauses through edits and undo',
  ({ language, source: originalSource, clauses: expectedClauses, bodyDeclarations, edits = [] }) => {
    const parser = new Parser().setLanguage(language);
    const query = new Query(language, '(("where" @keyword) (local_binds) @body)');
    let source = originalSource;
    let tree = parser.parse(source)!;
    try {
      expectClauses(tree.rootNode, query, source, expectedClauses, bodyDeclarations);
      const original = snapshot(tree.rootNode);
      const roundTrips: ClauseEdit[] = [
        {
          before: '1',
          after: '22',
          clauses: expectedClauses.map((text) => text.replace('1', '22')),
          bodyDeclarations,
        },
        ...edits,
      ];
      for (const edit of roundTrips) {
        const startIndex = source.indexOf(edit.before);
        expect(startIndex).toBeGreaterThanOrEqual(0);
        let previous = edit.before;
        for (const [replacement, clauses, bodies] of [
          [edit.after, edit.clauses, edit.bodyDeclarations],
          [edit.before, expectedClauses, bodyDeclarations],
        ] as const) {
          const oldEndIndex = startIndex + previous.length;
          const newEndIndex = startIndex + replacement.length;
          const newSource = source.slice(0, startIndex) + replacement + source.slice(oldEndIndex);
          tree.edit(
            new Edit({
              startIndex,
              oldEndIndex,
              newEndIndex,
              startPosition: position(source, startIndex),
              oldEndPosition: position(source, oldEndIndex),
              newEndPosition: position(newSource, newEndIndex),
            })
          );
          source = newSource;
          previous = replacement;
          const next = parser.parse(source, tree)!;
          tree.delete();
          tree = next;
          const fresh = parser.parse(source)!;
          try {
            expectClauses(tree.rootNode, query, source, clauses, bodies);
            expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
          } finally {
            fresh.delete();
          }
        }
        expect(source).toBe(originalSource);
        expect(snapshot(tree.rootNode)).toEqual(original);
      }
    } finally {
      tree.delete();
      query.delete();
      parser.delete();
    }
  }
);

function expectClauses(
  rootNode: Node,
  query: Query,
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
  const captured = query
    .matches(rootNode)
    .map(({ captures }) => {
      const keyword = captures.find(({ name }) => name === 'keyword')!.node;
      const body = captures.find(({ name }) => name === 'body')!.node;
      return [keyword.startIndex, body.endIndex] as const;
    })
    .toSorted(([a], [b]) => a - b);
  const withBodies = clauses.filter((clause) => clause.childForFieldName('binds'));
  expect(captured).toEqual(withBodies.map((clause) => [clause.startIndex, clause.endIndex]));
  const following = rootNode.childForFieldName('declarations')?.lastNamedChild;
  expect(following?.text).toBe('following = 2');
  expect(following?.startPosition).toEqual(position(source, source.indexOf('following')));
}

function snapshot(rootNode: Node): unknown[] {
  const pending = [rootNode];
  const nodes = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    const children = node.children;
    nodes.push([
      node.type,
      node.startIndex,
      node.endIndex,
      node.startPosition,
      node.endPosition,
      node.isNamed,
      node.isMissing,
      node.isError,
      children.map((_, index) => node.fieldNameForChild(index)),
    ]);
    pending.push(...children.toReversed());
  }
  return nodes;
}

function position(source: string, index: number): { row: number; column: number } {
  const lines = source.slice(0, index).split('\n');
  return { row: lines.length - 1, column: lines.at(-1)!.length };
}
