# @willbooster/tree-sitter-haskell

[![npm version](https://img.shields.io/npm/v/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![license](https://img.shields.io/npm/l/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![Test](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml)
[![Test rust](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![wbfy](https://img.shields.io/badge/wbfy-20.43.2-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)
[![crates.io](https://img.shields.io/crates/v/willbooster-tree-sitter-haskell.svg)](https://crates.io/crates/willbooster-tree-sitter-haskell)

Haskell grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter), forked from
[tree-sitter/tree-sitter-haskell](https://github.com/tree-sitter/tree-sitter-haskell). We are grateful
to its authors and contributors. This is not an official release of that project.

This fork is based on upstream's version 0.23.1 grammar and generates the parser with the
[WillBooster/tree-sitter](https://github.com/WillBooster/tree-sitter) generator. The parser carries that fork's own ABI number. This package supports the fork's runtime version 10.0.2 or later within 10.x in the 10.x series; upstream's runtime rejects it.
[Upstream's README at that version](https://github.com/tree-sitter/tree-sitter-haskell/blob/v0.23.1/README.md) lists
the supported language extensions. The fork's node and query contracts are described below.

## Differences from upstream

The fork's main differences from upstream 0.23.1 are:

- **Whitespace**: horizontal tabs separate tokens, are accepted before Haddock markers, and advance layout to the next eight-column tab stop.
- **ExplicitNamespaces**: import and export items, including subordinate items, accept the `data` namespace, and fixity declarations accept `type` and `data`. A namespaced subordinate item such as `type (#)` or `data P` is a `namespaced_child` node with a `namespace` child; a `data` item puts a constructor name in a `constructor` field and a variable or operator in the `variable` or `operator` field.
- **NamedDefaults**: `default` declarations accept a class name before the type list, such as `default Monoid ([Int])`, in a `class` field, and export lists accept `default` items such as `default Monoid` as `default_export` nodes.
- **OrPatterns**: parenthesized alternatives separated by semicolons, such as `(A; B)`, parse as an `or_pattern` node with an `alternative` field for each pattern.
- **MultilineStrings**: triple-quoted literals retain their complete source as a single `string` node, including embedded quotes, escapes, and string gaps.
- **Comment scanning**: comments and Haddock nodes expose a named `content` child, preserving body whitespace and excluding outer delimiters. Ordinary comment injection captures this child.
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

## Usage

The npm package ships `tree-sitter-haskell.wasm` for
[@willbooster/web-tree-sitter](https://www.npmjs.com/package/@willbooster/web-tree-sitter) version 10.0.2 or later within 10.x in the 10.x series, which runs in Node.js, Bun, browsers, and Cloudflare Workers. In Node.js and Bun, load the grammar from its path:

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
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtimeUrl from '@willbooster/web-tree-sitter/web-tree-sitter.wasm?url';
import haskellUrl from '@willbooster/tree-sitter-haskell/tree-sitter-haskell.wasm?url';

await Parser.init({ locateFile: () => runtimeUrl });
const parser = new Parser();
parser.setLanguage(await Language.load(haskellUrl));
```

Cloudflare Workers do not allow compiling Wasm at run time, so import both `.wasm` files as modules, with or without
Node.js compatibility:

```js
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtime from '@willbooster/web-tree-sitter/web-tree-sitter.wasm';
import haskell from '@willbooster/tree-sitter-haskell/tree-sitter-haskell.wasm';

await Parser.init({ wasmModule: runtime });
const parser = new Parser();
parser.setLanguage(await Language.load(haskell));
```

The package also ships `grammar.js` with the files in `grammar/` it loads, the queries in `queries/`, and the node types in `src/node-types.json`.

For [hsc2hs](https://github.com/haskell/hsc2hs) source in `.hsc` files, load `tree-sitter-hsc.wasm` instead. This dialect parses C directives and the doubled hashes that hsc2hs turns into literal hashes. Its node schema is `hsc/src/node-types.json`. Combine the ordinary queries with the matching suffixes in `hsc/queries/` for directive highlighting and C-body injections.

For code navigation, use `queries/tags.scm` (or `TAGS_QUERY` in Rust). It indexes module headers, top-level named functions and bindings, named types and classes, class and instance methods, and syntactic variable/operator calls. A signature and each equation have separate definition locations. Call references identify the called name without resolving its binding.

Declaration names and variable/operator callees remain indexed through nested parentheses. Class and instance equations retain their method roles; grouping a value without applying it does not create a call reference. Destructuring bindings contribute their explicit names at every nesting depth, including as-pattern binders and record puns. Local pattern bindings, names bound by patterns inside declaration quotes and constructors (including pattern synonyms) are not indexed.

Function and type declaration-head parentheses are anonymous syntax: the enclosing declaration directly exposes its `name`, parameter groups and infix `head` fields. Parentheses inside parameters and types retain their existing nodes. A grouped variable name, including a qualified name, uses one `parenthesized_name` node with a direct name child, independent of grouping depth. A symbolic variable operator keeps its required prefix parentheses in `prefix_id`: `(<+>)` and `(Demo.<+>)` remain `prefix_id`, while redundant grouping such as `((<+>))` adds one `parenthesized_name` wrapper around that node. This also applies to unapplied names; only function position creates a call reference or call highlight. A parenthesized simple binding name uses `parenthesized_name` in the `bind` node's `name` field, retaining one wrapper at any grouping depth. Complex expressions retain ordinary `parens` nodes. These changes affect public syntax trees.

Operator uses retain unresolved source order. Expressions use `operator_chain` with repeated `operand` and `operator` fields: `6 * 7 == 42` has operands `6`, `7`, `42` and operators `*`, `==`. Application stays inside an operand; explicit parentheses and greedy block bodies retain their own grouping. A `prefix_operator` field records each named `prefix_negation` token at its source position, including unary-only chains. Its semantic extent depends on fixities and language extensions, so the tree does not assign it an operand subtree.

Type, pattern and constraint operators use `infix_chain` with repeated `operand` and `operator` fields, even for a single operator. Function, type and data declaration heads retain the `infix` node because they define one operator. Instance and standalone deriving implementation tags identify a class only for a single-operator head; multi-operator heads require fixity resolution by the caller.

Queries distinguish operands through the `expression_operand`, `type_operand`, `pattern_operand`, `binding_pattern_operand` and `constraint_operand` supertypes. For example, `(expression_operand/variable)` selects an expression variable and `(binding_pattern_operand/variable)` selects an explicit module-binding name. Match chains directly with `(operator_chain)` or `(infix_chain)` and their fields. The concrete operand node names remain shared across contexts. A `binding_field_pattern/field_pattern` with a `field` field and no `pattern` field is a module binding record pun. The `decl` supertype covers bindings in local blocks and declaration quotes; module declarations use `declaration`.

In a repository checkout, configure the CLI parser directories to include the grammar, then run `script/tree-sitter tags file.hs` to inspect the tags.

In Rust, depend on the [crate](https://crates.io/crates/willbooster-tree-sitter-haskell) and on
[willbooster-tree-sitter](https://crates.io/crates/willbooster-tree-sitter), the runtime this package is tested and
fuzzed with:

```toml
[dependencies]
tree-sitter = { package = "willbooster-tree-sitter", version = "10.0.2" }
tree-sitter-haskell = { package = "willbooster-tree-sitter-haskell", version = "12" }
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_haskell::LANGUAGE.into())?;
```

For `.hsc` files in Rust, select `HSC_LANGUAGE` and `HSC_NODE_TYPES`. Use `HSC_HIGHLIGHTS_QUERY` and `HSC_INJECTIONS_QUERY` for the combined queries; `TAGS_QUERY` and `LOCALS_QUERY` are shared with ordinary Haskell.

## Development

```sh
mise install
bun install --frozen-lockfile
bun run test/ci-setup # installs Chromium for the browser test
bun run build/ci
bun run test
script/parse-examples
cargo test
```

The scripts and tests generate, build, test, and parse with `script/tree-sitter`, the tree-sitter CLI of the
WillBooster/tree-sitter runtime version locked in `Cargo.lock`, since the generator and the runtime of upstream's CLI are
not the ones this package ships with. Its first run downloads that CLI from the runtime's GitHub Release, or builds it
with `cargo` (whose build runs the CMake that `mise.toml` pins) when the download fails or the release has no binary that runs here. Run other CLI commands through it as
well (e.g. `script/tree-sitter parse file.hs`).

`bun run generate` records a fresh generation profile from the applicable `test/corpus` cases and Git-tracked
files in `examples/`, then generates compact parser tables. The parser also embeds metadata from `tree-sitter.json`. After changing a grammar file,
`tree-sitter.json`, a corpus case, or a tracked example,
regenerate and commit `src/` and `hsc/src/`. Stage added or removed examples with `git add -A examples` before generation so the profile uses the intended file list.
Profiles in `.tmp/generation-profiles/` are temporary and must not be committed. `bun run build-wasm`, `bun run build/ci`,
and the release build regenerate the parsers before compiling them.

`bun run test` runs:

- the corpus in `test/corpus`, with the native build and with the Wasm build (the first run downloads the WASI SDK);
- an incremental-parsing check (`test/unit/incremental.test.ts`): `script/fuzz-corpus` runs `tree-sitter fuzz`, which
  edits each corpus case at random, reparses it, undoes the edits, and reparses again. `TREE_SITTER_SEED`,
  `TREE_SITTER_ITERATIONS`, and `TREE_SITTER_EDITS` run other or more edits;
- a check that the real-world Haskell files in `examples/`, the checked-in ones and those of the cloned repositories, fail to
  parse exactly as listed in `script/known-failures.txt`. The first run clones the repositories. The example repositories are pinned to commits in
  `script/parse-examples`. After a grammar change or a moved pin alters that list, `script/parse-examples` rewrites it;
  review its diff before committing;
- a performance check (`test/unit/performance.test.ts`) that recovering from an error on each line takes linear
  time, since consumers parse files while they are being edited. It loads the Wasm build through
  @willbooster/web-tree-sitter, which `bun run build/ci` rebuilds after regenerating the parser;
- a check (`test/unit/runtimeVersion.test.ts`) that `@willbooster/web-tree-sitter` in `package.json` and
  `willbooster-tree-sitter` in `Cargo.lock` are the same version, since the Wasm tests run on the former and the Rust
  tests, the fuzzer, and the CLI on the latter;
- tests that load the Wasm build with @willbooster/web-tree-sitter in Chromium (`test/e2e/browser.test.ts`) and in
  Cloudflare Workers with and without Node.js compatibility (`test/e2e/workers.test.ts`).

The tests and `script/parse-examples` compile the parser into `.tmp/tree-sitter-lib` rather than the CLI's cache shared
by every checkout; `script/fuzz-corpus` builds a parser of its own in `.tmp/fuzz` for each run and deletes it
afterwards.

CI also runs these tests on Linux arm64 and macOS, where the CLI compiles the parser and the scanner natively, and fuzzes the parser
with libFuzzer and sanitizers (`.github/workflows/robustness.yml`).

### References

- [Haskell 2010 Language Report: Syntax Reference](https://www.haskell.org/onlinereport/haskell2010/haskellch10.html)
- [GHC Language Extensions](https://downloads.haskell.org/~ghc/latest/docs/html/users_guide/exts/table.html)
