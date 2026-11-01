import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { afterAll, expect, test } from 'vitest';

import { currentWasmPath } from '../helpers/generationInputs.js';

await Parser.init();
const parsers = await Promise.all(
  (['haskell', 'hsc'] as const).map(async (dialect) => {
    const parser = new Parser();
    parser.setLanguage(await Language.load(currentWasmPath(path.resolve(import.meta.dirname, '../..'), dialect)));
    return parser;
  })
);
afterAll(() => {
  for (const parser of parsers) parser.delete();
});

const declarations = ['value = 1', 'value :: Int', 'data Value = Value', 'type Value = Int', '$(pure [])'];

const cppMacroPrograms = [
  {
    name: 'expression',
    source: '{-# LANGUAGE CPP #-}\nmodule Probe where\n#define import 1\nvalue = import\nfollowing=2\n',
    bindings: ['value', 'following'],
    splices: [],
  },
  {
    name: 'object macro form',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define import const (pure [])\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'function macro call',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define import(value) const (pure []) value\nimport(Prelude.True)\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: ['import(Prelude.True)'],
  },
  {
    name: 'else-branch definition',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#if 0\n-- inactive\n#else\n#define import const (pure [])\n#endif\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'conditional undefinition',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define import const (pure [])\n#if 0\n#undef import\n#endif\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'NUL in a closed C comment',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define /* comment\0 */ import const (pure [])\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'multiline comment in definition',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define /* comment\n-- */ import const (pure [])\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'comment-separated definition',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define/* gap */import const (pure [])\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
  {
    name: 'spliced macro name',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define im\\\nport const (pure [])\nimport Prelude.True\nfollowing=2\n',
    bindings: ['seed', 'following'],
    splices: [],
    imports: ['import Prelude.True'],
  },
];

const cppImportRejections = [
  {
    name: 'unconditional undefinition',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define import const (pure [])\n#undef import\nimport Data.Maybe\n',
  },
  {
    name: 'different macro name',
    source:
      '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define imported const (pure [])\nimport Data.Maybe\n',
  },
];

for (const [dialect, parser] of ['Haskell', 'HSC'].map((name, index) => [name, parsers[index]!] as const)) {
  test.each(declarations)(`${dialect} rejects an import after %s`, (declaration) => {
    for (const source of [
      `${declaration}\nimport Data.Maybe\n`,
      `module Probe where\nimport Data.List\n${declaration}\nimport Data.Maybe\n`,
    ]) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(true);
      } finally {
        tree.delete();
      }
    }
  });

  test(`${dialect} preserves an inactive conditional import after a declaration`, () => {
    const tree = parser.parse("{-# LANGUAGE CPP #-}\nmodule A where\nv1 = 'a'\n#if 0\nimport Data.Maybe\n#endif\n")!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'v1',
      ]);
      expect(
        tree.rootNode
          .descendantsOfType('import')
          .filter((node) => node.isNamed)
          .map((node) => node.text)
      ).toEqual(['import Data.Maybe']);
    } finally {
      tree.delete();
    }
    const outside = parser.parse("{-# LANGUAGE CPP #-}\nmodule A where\nv1 = 'a'\n#if 0\n#endif\nimport Data.Maybe\n")!;
    try {
      expect(outside.rootNode.hasError).toBe(true);
    } finally {
      outside.delete();
    }
  });

  test.each([
    'import Data.Maybe\nimport Data.List\nvalue = Just 1\nfollowing = value\n',
    'module Probe where\nimport Data.Maybe\n-- between sections\nvalue = Just 1\nfollowing = value\n',
    'module Probe where\nvalue = Just 1\nfollowing = value\n',
    'imported = 1\nvalue = imported\nfollowing = value\n',
  ])(`${dialect} preserves initial imports and following bindings: %j`, (source) => {
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        ...(source.startsWith('imported') ? ['imported'] : []),
        'value',
        'following',
      ]);
      const imports = tree.rootNode.childForFieldName('imports');
      const namedImports = tree.rootNode.descendantsOfType('import').filter((node) => node.isNamed);
      const expectedImports = source.startsWith('import Data.Maybe')
        ? ['import Data.Maybe', 'import Data.List']
        : source.includes('import Data.Maybe')
          ? ['import Data.Maybe']
          : [];
      expect(namedImports.map((node) => node.text)).toEqual(expectedImports);
      expect(namedImports.every((node) => node.parent?.id === imports?.id)).toBe(true);
    } finally {
      tree.delete();
    }
  });
}

for (const [dialect, parser] of ['Haskell', 'HSC'].map((name, index) => [name, parsers[index]!] as const)) {
  test.each(['import', 'Data.import'])(`${dialect} permits the keyword in quasiquoter %s`, (name) => {
    const source = `{-# LANGUAGE QuasiQuotes #-}\nmodule Probe where\nvalue = [${name}|body|]\nfollowing = 2\n`;
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(tree.rootNode.descendantsOfType('quoter').map((node) => node.text)).toEqual([name]);
      expect(tree.rootNode.descendantsOfType('quasiquote_body').map((node) => node.text)).toEqual(['body']);
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'value',
        'following',
      ]);
    } finally {
      tree.delete();
    }
  });
}

for (const [dialect, parser] of ['Haskell', 'HSC'].map((name, index) => [name, parsers[index]!] as const)) {
  test.each(['value = Data.import', 'value = left `Data.import` right', "value = 'Data.import"])(
    `${dialect} permits the qualified keyword in %s`,
    (declaration) => {
      const source = `{-# LANGUAGE TemplateHaskell #-}\nmodule Probe where\n${declaration}\nfollowing=2\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(tree.rootNode.descendantsOfType('qualified').map((node) => node.text)).toContain('Data.import');
        expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
          'value',
          'following',
        ]);
      } finally {
        tree.delete();
      }
    }
  );

  test.each([
    'value = C { Data.import = 1 }',
    'value = candidate { Data.import = 1 }',
    'value = case candidate of C { Data.import = bound } -> bound',
  ])(`${dialect} retains the qualified field in %s`, (declaration) => {
    const source = `module Probe where\n${declaration}\nfollowing=2\n`;
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      expect(
        tree.rootNode
          .descendantsOfType('qualified')
          .filter((node) => node.text === 'Data.import')
          .map((node) => node.childForFieldName('id')?.type)
      ).toEqual(['field_name']);
      expect(tree.rootNode.descendantsOfType('field_name').map((node) => node.text)).toContain('import');
      expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual([
        'value',
        'following',
      ]);
    } finally {
      tree.delete();
    }
  });

  if (dialect === 'Haskell') {
    test.each(cppMacroPrograms)(
      `${dialect} retains local import macros: $name`,
      ({ source, bindings, splices, imports = [] }) => {
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
          expect(tree.rootNode.descendantsOfType('bind').map((node) => node.childForFieldName('name')?.text)).toEqual(
            bindings
          );
          expect(tree.rootNode.descendantsOfType('top_splice').map((node) => node.text)).toEqual(splices);
          expect(
            tree.rootNode
              .descendantsOfType('import')
              .filter((node) => node.isNamed)
              .map((node) => node.text)
          ).toEqual(imports);
        } finally {
          tree.delete();
        }
      }
    );
  }

  test.each([
    '#if 0\nvalue=1\n#endif\nimport Data.Maybe\n',
    ...(dialect === 'Haskell' ? ['#define NOP\nNOP\nimport Data.Maybe\n'] : []),
  ])(`${dialect} preserves an import after CPP removes a raw declaration: %j`, (body) => {
    const tree = parser.parse(`{-# LANGUAGE CPP #-}\nmodule Probe where\n${body}`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(
        tree.rootNode
          .descendantsOfType('import')
          .filter((node) => node.isNamed)
          .map((node) => node.text)
      ).toEqual(['import Data.Maybe']);
    } finally {
      tree.delete();
    }
  });

  if (dialect === 'Haskell') {
    test.each([' ', '\t', ' \t'])(`${dialect} retains whitespace-separated macro continuations: %j`, (gap) => {
      const source = `{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define im\\${gap}\nport const (pure [])\nimport Prelude.True\nfollowing=2\n`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(
          tree.rootNode
            .descendantsOfType('import')
            .filter((node) => node.isNamed)
            .map((node) => node.text)
        ).toEqual(['import Prelude.True']);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following=2');
      } finally {
        tree.delete();
      }
    });
  } else {
    test('HSC does not expand C import macros in Haskell declarations', () => {
      const tree = parser.parse(
        '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\nseed=()\n#define import X\nimport Data.Maybe\nfollowing=2\n'
      )!;
      try {
        expect(tree.rootNode.hasError).toBe(true);
      } finally {
        tree.delete();
      }
    });

    test('HSC C includes do not hide ordinary late imports', () => {
      const tree = parser.parse('module Probe where\n#include <stdio.h>\nvalue=1\nimport Data.Maybe\n')!;
      try {
        expect(tree.rootNode.hasError).toBe(true);
      } finally {
        tree.delete();
      }
    });

    test('HSC permits an import after an empty custom construct', () => {
      const tree = parser.parse('module Probe where\n#let nop = ""\n#nop\nimport Data.Maybe\nvalue=Just 1\n')!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(
          tree.rootNode
            .descendantsOfType('import')
            .filter((node) => node.isNamed)
            .map((node) => node.text)
        ).toEqual(['import Data.Maybe']);
      } finally {
        tree.delete();
      }
    });
  }

  test(`${dialect} keeps ordinary imports when a function macro is not invoked`, () => {
    const tree = parser.parse(
      '{-# LANGUAGE CPP #-}\nmodule Probe where\n#define import(x) x\nimport Data.Maybe\nvalue=Just 1\n'
    )!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.childForFieldName('imports')?.namedChildren.map((node) => node.text)).toEqual([
        'import Data.Maybe',
      ]);
      expect(tree.rootNode.descendantsOfType('top_splice')).toHaveLength(0);
    } finally {
      tree.delete();
    }
  });

  test(`${dialect} rejects a late import after a shebang`, () => {
    const tree = parser.parse('#!/usr/bin/env runhaskell\nmodule Main where\nx=1\nimport Data.Maybe\n')!;
    try {
      expect(tree.rootNode.hasError).toBe(true);
    } finally {
      tree.delete();
    }
  });

  if (dialect === 'Haskell') {
    test.each(['#define/* unterminated\ny=2\n', '#if 1\n#else\n#define/* unterminated\n#endif\ny=2\n'])(
      'Haskell reports an unclosed CPP directive comment: %j',
      (body) => {
        const tree = parser.parse(`{-# LANGUAGE CPP #-}\nmodule Probe where\nx=1\n${body}`)!;
        try {
          expect(tree.rootNode.hasError).toBe(true);
        } finally {
          tree.delete();
        }
      }
    );
  }

  test.each([
    '#define import import\n',
    '#if 0\n#define import 1\n#endif\n',
    '#ifdef FOO\n#define import 1\n#else\n#undef import\n#endif\n',
  ])(`${dialect} preserves ordinary imports with uncertain macro bindings: %j`, (directives) => {
    const tree = parser.parse(`{-# LANGUAGE CPP #-}\nmodule Probe where\n${directives}import Data.Maybe\nx=1\n`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.childForFieldName('imports')?.namedChildren.map((node) => node.text)).toEqual([
        'import Data.Maybe',
      ]);
      expect(tree.rootNode.descendantsOfType('top_splice')).toHaveLength(0);
    } finally {
      tree.delete();
    }
  });

  if (dialect === 'Haskell') {
    test('Haskell preserves closed multiline calls after an invalid full-parse input', () => {
      const invalid = parser.parse('#define import(x) x\nvalue=1\nimport /* unclosed\n')!;
      try {
        expect(invalid.rootNode.hasError).toBe(true);
      } finally {
        invalid.delete();
      }
      const valid = parser.parse(
        '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Example where\n#define import const (pure [])\nimport /* first\nsecond */ (True)\nfollowing=2\n'
      )!;
      try {
        expect(valid.rootNode.hasError).toBe(false);
        expect(valid.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following=2');
      } finally {
        valid.delete();
      }
    });
  }

  test.each(cppImportRejections)(`${dialect} rejects late imports after $name`, ({ source }) => {
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(true);
    } finally {
      tree.delete();
    }
  });

  test(`${dialect} reports invalid where layout without prescribing its recovery tree`, () => {
    const source = 'a = case a of\n  a -> a\n  where\n    a = a\n  a -> a\n';
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(true);
    } finally {
      tree.delete();
    }
  });

  test(`${dialect} retains a declaration quote and following binding`, () => {
    const source = '{-# LANGUAGE TemplateHaskell #-}\nmodule Probe where\n[d| generated=1 |]\nfollowing=2\n';
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('top_splice').map((node) => node.text)).toEqual(['[d| generated=1 |]']);
      expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following=2');
    } finally {
      tree.delete();
    }
  });

  test(`${dialect} preserves nested records when CPP metadata fills the scanner buffer`, () => {
    let state = 0x12_34_56_78;
    let expression = 'Leaf';
    let records = 0;
    for (let depth = 0; depth < 1511; depth++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      if (state >>> 31) {
        expression = `Box { child = ${expression} }`;
        records++;
      } else expression = `(${expression})`;
    }
    const prefix = '{-# LANGUAGE CPP, TemplateHaskell #-}\nmodule Probe where\n';
    const body = `data Value = Box { child :: Value } | Leaf\n#if 1\nvalue = ${expression}\n#endif\n`;
    for (const source of [
      `${prefix}${body}following=1\n`,
      ...(dialect === 'Haskell'
        ? [`${prefix}#define import const (pure [])\n${body}import Prelude.True\nfollowing=1\n`]
        : []),
    ]) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.descendantsOfType('field_update')).toHaveLength(records);
        expect(tree.rootNode.childForFieldName('declarations')?.lastNamedChild?.text).toBe('following=1');
      } finally {
        tree.delete();
      }
    }
    const invalid = parser.parse(
      `module Probe where\n${body.replace('#if 1\n', '').replace('#endif\n', '')}import Data.Maybe\n`
    )!;
    try {
      expect(invalid.rootNode.hasError).toBe(true);
    } finally {
      invalid.delete();
    }
  });

  test(`${dialect} keeps CPP source facts local to each full-parse input`, () => {
    const source = dialect === 'Haskell' ? '#define import 1\nvalue=import\n' : '#if 0\nunused=1\n#endif\nvalue=1\n';
    const macro = parser.parse(`{-# LANGUAGE CPP #-}\nmodule Probe where\n${source}`)!;
    try {
      expect(macro.rootNode.hasError).toBe(false);
    } finally {
      macro.delete();
    }
    const ordinary = parser.parse('module Probe where\nvalue=1\nimport Data.Maybe\n')!;
    try {
      expect(ordinary.rootNode.hasError).toBe(true);
    } finally {
      ordinary.delete();
    }
  });
}
