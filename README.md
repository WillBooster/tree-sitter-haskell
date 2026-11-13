# @willbooster/tree-sitter-haskell

[![npm version](https://img.shields.io/npm/v/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![license](https://img.shields.io/npm/l/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![Test](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml)
[![Test rust](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![wbfy](https://img.shields.io/badge/wbfy-21.3.0-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)
[![crates.io](https://img.shields.io/crates/v/willbooster-tree-sitter-haskell.svg)](https://crates.io/crates/willbooster-tree-sitter-haskell)

Haskell grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter), forked from
[tree-sitter/tree-sitter-haskell](https://github.com/tree-sitter/tree-sitter-haskell). We are grateful
to its authors and contributors. This is not an official release of that project.

This fork is based on upstream's version 0.23.1 grammar and generates the parser with the
[WillBooster/tree-sitter](https://github.com/WillBooster/tree-sitter) generator. The parser carries ABI `0x5742000c`, which upstream Tree-sitter runtimes reject. This package targets and requires the fork's non-incremental 20.x runtime (`@willbooster/web-tree-sitter` / `willbooster-tree-sitter` version 20.0.0 or later within 20.x). Earlier WillBooster runtimes also share ABI `0x5742000c` and pass the ABI check, so the ABI check alone does not reject incompatible runtimes: 17.x and 18.x dereference `TSLanguage` tables omitted since 19.1.0, and 19.x predates the 20.0.0 full-parse-only API.
[Upstream's README at that version](https://github.com/tree-sitter/tree-sitter-haskell/blob/v0.23.1/README.md) lists
the supported language extensions. The fork's node contracts are described below.

## Differences from upstream

The fork's main differences from upstream 0.23.1 are:

- **Whitespace**: horizontal tabs separate tokens, are accepted before Haddock markers, and advance layout to the next eight-column tab stop.
- **ExplicitNamespaces**: import and export items, including subordinate items, accept the `data` namespace, and fixity declarations accept `type` and `data`. A namespaced subordinate item such as `type (#)` or `data P` is a `namespaced_child` node with a `namespace` child; a `data` item puts a constructor name in a `constructor` field and a variable or operator in the `variable` or `operator` field.
- **Import modifiers**: imports accept the `ExplicitLevelImports` levels `splice` and `quote`, before or after the module name, as an `import_level` node in a `level` field, and the Safe Haskell `safe` keyword, such as `import splice safe qualified M as N`.
- **LinearTypes**: local `let` and `where` bindings accept a multiplicity annotation, such as `let %1 x = u`, as a `modifier` node in the binding's `multiplicity` field; such bindings are not part of the `decl` supertype.
- **NamedDefaults**: `default` declarations accept a class name before the type list, such as `default Monoid ([Int])`, in a `class` field, and export lists accept `default` items such as `default Monoid` as `default_export` nodes.
- **OrPatterns**: parenthesized alternatives separated by semicolons, such as `(A; B)`, parse as an `or_pattern` node with an `alternative` field for each pattern.
- **MultilineStrings**: triple-quoted literals retain their complete source as a single `string` node, including embedded quotes, escapes, and string gaps.
- **Comment scanning**: comments and Haddock nodes expose a named `content` child, preserving body whitespace and excluding outer delimiters.
  Empty block comments such as `{--}` terminate at their closing delimiter and preserve following code.
  An ordinary line comment does not absorb a following marked Haddock comment.
  Unmarked continuation lines remain in their preceding Haddock block, including space or tab indentation and LF or CRLF newlines.
  First-column ordinary comments combine with LF line endings.
  CRLF and indented ordinary comments remain separate comment nodes.
- **`test/corpus/varsym.txt`**: the expected recovery tree for the invalid `f = a | a` input matches this generator; the input still reports an error.
- **`test/corpus/null-characters.txt`** is added, because the fuzz job checks that every NUL character of the corpus
  reaches the fuzz seeds and upstream's corpus has none.

A NUL character inside a string or character literal parses as part of the literal, where upstream's prebuilt parser
reports an error: the lexers of the WillBooster/tree-sitter generator let character classes match a NUL character.

## Support Scope

This fork supports only full parsing: valid input yields a correct tree, and invalid input yields `ERROR` or `MISSING`
nodes without crashing, hanging, or taking more than linear time. Incremental parsing is not supported, and no queries
(highlights, locals, injections, tags) are shipped. Node types, field names, and the trees that error recovery produces
may change; such changes are released as new major versions.

## Usage

The npm package ships `tree-sitter-haskell.wasm` for
[@willbooster/web-tree-sitter](https://www.npmjs.com/package/@willbooster/web-tree-sitter) version 20.0.0 or later within 20.x, which runs in Node.js, Bun, browsers, and Cloudflare Workers. In Node.js and Bun, load the grammar from its path:

```js
import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';

await Parser.init();
const parser = new Parser();
const wasmPath = fileURLToPath(import.meta.resolve('@willbooster/tree-sitter-haskell/tree-sitter-haskell.wasm'));
parser.setLanguage(await Language.load(wasmPath));
const tree = parser.parse('main = putStrLn "Hello World!"\n');
```

In browsers, serve both `.wasm` files and load them by URL (the example uses Vite's `?url` imports):

```js
import haskellUrl from '@willbooster/tree-sitter-haskell/tree-sitter-haskell.wasm?url';
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtimeUrl from '@willbooster/web-tree-sitter/web-tree-sitter.wasm?url';

await Parser.init({ locateFile: () => runtimeUrl });
const parser = new Parser();
parser.setLanguage(await Language.load(haskellUrl));
```

Cloudflare Workers do not allow compiling Wasm at run time, so import both `.wasm` files as modules, with or without
Node.js compatibility:

```js
import haskell from '@willbooster/tree-sitter-haskell/tree-sitter-haskell.wasm';
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtime from '@willbooster/web-tree-sitter/web-tree-sitter.wasm';

await Parser.init({ wasmModule: runtime });
const parser = new Parser();
parser.setLanguage(await Language.load(haskell));
```

The package also ships `grammar.js` with the files in `grammar/` it loads and the node types in `src/node-types.json`.

For [hsc2hs](https://github.com/haskell/hsc2hs) source in `.hsc` files, load `tree-sitter-hsc.wasm` instead. This dialect parses C directives and the doubled hashes that hsc2hs turns into literal hashes. Its node schema is `hsc/src/node-types.json`.

Function and type declaration-head parentheses are anonymous syntax: the enclosing declaration directly exposes its `name`, parameter groups and infix `head` fields. Parentheses inside parameters and types retain their existing nodes. A grouped variable name, including a qualified name, uses one `parenthesized_name` node with a direct name child, independent of grouping depth. A symbolic variable operator keeps its required prefix parentheses in `prefix_id`: `(<+>)` and `(Demo.<+>)` remain `prefix_id`, while redundant grouping such as `((<+>))` adds one `parenthesized_name` wrapper around that node. This also applies to unapplied names. A parenthesized simple binding name uses `parenthesized_name` in the `bind` node's `name` field, retaining one wrapper at any grouping depth. Complex expressions retain ordinary `parens` nodes. These changes affect public syntax trees.

Local `where` clauses form a `where_clause` node spanning the keyword and its binding block. Enclosing bindings, functions and case alternatives expose it through their `binds` field; the clause's optional `binds` field contains `local_binds`. The latter's `decl` fields and source ranges are unchanged. This provides a single named node for selecting or identifying the scope of `where` without including the enclosing declaration. For `let`, `binds` directly contains `local_binds`. Sibling `"where"` and `local_binds` children remain available with their separate ranges.

Operator uses retain unresolved source order. Expressions use `operator_chain` with repeated `operand` and `operator` fields: `6 * 7 == 42` has operands `6`, `7`, `42` and operators `*`, `==`. Application stays inside an operand; explicit parentheses and greedy block bodies retain their own grouping. A `prefix_operator` field records each named `prefix_negation` token at its source position, including unary-only chains. Its semantic extent depends on fixities and language extensions, so the tree does not assign it an operand subtree.

Type, pattern and constraint operators use `infix_chain` with repeated `operand` and `operator` fields, even for a single operator. Function, type and data declaration heads retain the `infix` node because they define one operator.

Node schemas (`src/node-types.json` and `hsc/src/node-types.json`) distinguish operands through the `expression_operand`, `type_operand`, `pattern_operand`, `binding_pattern_operand` and `constraint_operand` supertypes while keeping shared concrete operand node names across contexts. Inspect chains directly through `operator_chain` or `infix_chain` and their fields. A `field_pattern` under `binding_field_pattern` with a `field` field and no `pattern` field is a module binding record pun. The `decl` supertype covers bindings in local blocks and declaration quotes, except multiplicity-annotated local bindings, which are `bind` nodes directly; module declarations use `declaration`.

In Rust, depend on the [crate](https://crates.io/crates/willbooster-tree-sitter-haskell) and on
[willbooster-tree-sitter](https://crates.io/crates/willbooster-tree-sitter), the runtime this package is tested and
fuzzed with:

```sh
cargo add willbooster-tree-sitter@20.0.0 --rename tree-sitter
cargo add willbooster-tree-sitter-haskell --rename tree-sitter-haskell
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_haskell::LANGUAGE.into())?;
```

For `.hsc` files in Rust, select `HSC_LANGUAGE` and `HSC_NODE_TYPES`.

## Development

```sh
mise install
bun install --frozen-lockfile
bun run test/ci-setup
bun run build/ci
bun run verify
bun run test
cargo test --locked
```

- Run Tree-sitter CLI commands through `script/tree-sitter`, which uses the `willbooster-tree-sitter` version locked in `Cargo.lock`.
- Keep `@willbooster/web-tree-sitter` (`package.json`) and `willbooster-tree-sitter` (`Cargo.lock`) on the same version (`test/unit/runtimeVersion.test.ts`).
- After changing `grammar.js`, `grammar/`, `hsc/grammar.js`, `tree-sitter.json`, `test/corpus/`, or tracked files in `examples/`, stage `examples/` changes with `git add -A examples` and run `bun run build/ci` to regenerate `src/`, `hsc/src/`, and `*.wasm` (`script/generate`).
- After a grammar change or a moved commit pin in `script/parse-examples` alters which real-world files fail, run `script/parse-examples` and review the `script/known-failures.txt` diff before committing.

### References

- [Haskell 2010 Language Report: Syntax Reference](https://www.haskell.org/onlinereport/haskell2010/haskellch10.html)
- [GHC Language Extensions](https://downloads.haskell.org/~ghc/latest/docs/html/users_guide/exts/table.html)
