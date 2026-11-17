import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

const root = path.join(import.meta.dirname, '../..');
const fixtures = [
  {
    name: 'inline let expression',
    source: 'result = let infixr 5 <+>; x <+> y = x * 10 + y in 1 <+> 2 <+> 3',
  },
  {
    name: 'layout let expression',
    source: 'result =\n  let infixr 5 <+>\n      x <+> y = x * 10 + y\n  in 1 <+> 2 <+> 3',
  },
  {
    name: 'explicit let expression',
    source: 'result = let { infixr 5 <+>; x <+> y = x * 10 + y } in 1 <+> 2 <+> 3',
  },
  {
    name: 'layout do let',
    source: 'main = do\n  let infixr 5 <+>\n      x <+> y = x * 10 + y\n  print (1 <+> 2 <+> 3)',
  },
  {
    name: 'explicit do let',
    source: 'main = do { let { infixr 5 <+>; x <+> y = x * 10 + y }; print (1 <+> 2 <+> 3) }',
  },
  {
    name: 'comprehension let',
    source: 'result = [1 <+> 2 <+> 3 | let infixr 5 <+>; x <+> y = x * 10 + y]',
  },
  {
    name: 'explicit comprehension let',
    source: 'result = [1 <+> 2 <+> 3 | let { infixr 5 <+>; x <+> y = x * 10 + y }]',
  },
  {
    name: 'guard let',
    source: 'result n | let { infixr 5 <+>; x <+> y = x * 10 + y }, n > 0 = n <+> 1',
  },
  {
    name: 'where bindings',
    source: 'result = 1 <+> 2 <+> 3\n  where\n    infixr 5 <+>\n    x <+> y = x * 10 + y',
  },
];

await Parser.init();
const languages = await Promise.all(
  (['haskell', 'hsc', 'haskell_ghc2021'] as const).map(async (dialect) => ({
    dialect,
    language: await Language.load(currentWasmPath(root, dialect)),
  }))
);

test.each(languages.flatMap((language) => fixtures.map((fixture) => ({ ...language, ...fixture }))))(
  '$dialect parses fixity declarations inside $name',
  ({ language, source }) => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(`${source}\nsentinel = 0\n`)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const fixities = tree.rootNode.descendantsOfType('fixity');
      expect(fixities).toHaveLength(1);
      const fixity = fixities[0]!;
      expect(fixity.parent?.type).toBe('local_binds');
      expect(fixity.childForFieldName('associativity')?.text).toBe('infixr');
      expect(fixity.childForFieldName('precedence')?.text).toBe('5');
      expect(fixity.childrenForFieldName('operator').map((operator) => operator.text)).toEqual(['<+>']);
      expect(fixity.parent?.descendantsOfType('function').map((binding) => binding.text)).toContain(
        'x <+> y = x * 10 + y'
      );
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('sentinel = 0');
    } finally {
      tree.delete();
      parser.delete();
    }
  }
);

test.each(
  languages.flatMap((language) =>
    ['result = let { infixr 5; x = 1 } in x', 'result = let { infixr 5 <+>; x <+> y = } in 1'].map((source) => ({
      ...language,
      source,
    }))
  )
)('$dialect rejects malformed local declarations: $source', ({ language, source }) => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(`${source}\nsentinel = 0\n`)!;
  try {
    expect(tree.rootNode.hasError).toBe(true);
  } finally {
    tree.delete();
    parser.delete();
  }
});
