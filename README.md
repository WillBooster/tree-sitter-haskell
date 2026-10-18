# @willbooster/tree-sitter-haskell

[![npm version](https://img.shields.io/npm/v/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![license](https://img.shields.io/npm/l/@willbooster/tree-sitter-haskell.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-haskell)
[![Test](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test.yml)
[![Test rust](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-haskell/actions/workflows/test-rust.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![wbfy](https://img.shields.io/badge/wbfy-20.41.8-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)
[![crates.io](https://img.shields.io/crates/v/willbooster-tree-sitter-haskell.svg)](https://crates.io/crates/willbooster-tree-sitter-haskell)

Haskell grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter), forked from
[tree-sitter/tree-sitter-haskell](https://github.com/tree-sitter/tree-sitter-haskell). We are grateful
to its authors and contributors. This is not an official release of that project.

This fork is based on upstream's version 0.23.1 grammar and generates the parser with the
[WillBooster/tree-sitter](https://github.com/WillBooster/tree-sitter) generator. The parser carries that fork's own ABI number, so it loads only with that fork's runtime, version 4.0.2 or later in the 4.x series; upstream's runtime rejects it.
[Upstream's README at that version](https://github.com/tree-sitter/tree-sitter-haskell/blob/v0.23.1/README.md) lists
the supported language extensions and, under "Querying", explains how to query the grammar's supertypes; it is the
readme that the comments in `grammar.js` refer to.

## Differences from upstream

The fork's main differences from upstream 0.23.1 are:

- **Comment scanning**: empty block comments such as `{--}` terminate at their closing delimiter and preserve following code.
  An ordinary line comment does not absorb a following marked Haddock comment.
  Unmarked continuation lines remain in their preceding Haddock block, including space or tab indentation and LF or CRLF newlines.
  First-column ordinary comments combine with LF line endings.
  CRLF and indented ordinary comments remain separate comment nodes.
- **`queries/highlights.scm`**: three patterns that match fields of the supertype `decl` are written through its
  subtypes (`decl/function`, `decl/bind`, `decl/signature`), as upstream's repository has them since
  `tree-sitter/tree-sitter-haskell@0b2ebf7`. A parser of ABI 15 or later carries the supertypes, and the runtime then
  rejects the 0.23.1 patterns as impossible; upstream's own CLI 0.27.0 does so as well.
- **`test/corpus/varsym.txt`**: the expected recovery tree for the invalid `f = a | a` input matches this generator; the input still reports an error.
- **`test/corpus/null-characters.txt`** is added, because the fuzz job checks that every NUL character of the corpus
  reaches the fuzz seeds and upstream's corpus has none.

A NUL character inside a string or character literal parses as part of the literal, where upstream's prebuilt parser
reports an error: the lexers of the WillBooster/tree-sitter generator let character classes match a NUL character.

## Usage

The npm package ships `tree-sitter-haskell.wasm` for
[@willbooster/web-tree-sitter](https://www.npmjs.com/package/@willbooster/web-tree-sitter) version 4.0.2 or later in the 4.x series, which runs in Node.js, Bun, browsers, and Cloudflare Workers. In Node.js and Bun, load the grammar from its path:

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

In Rust, depend on the [crate](https://crates.io/crates/willbooster-tree-sitter-haskell) and on
[willbooster-tree-sitter](https://crates.io/crates/willbooster-tree-sitter), the runtime this package is tested and
fuzzed with:

```toml
[dependencies]
tree-sitter = { package = "willbooster-tree-sitter", version = "4.0.2" }
tree-sitter-haskell = { package = "willbooster-tree-sitter-haskell", version = "3" }
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_haskell::LANGUAGE.into())?;
```

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
regenerate and commit `src/`. Stage added or removed examples with `git add -A examples` before generation so the profile uses the intended file list.
Profiles in `.tmp/generation-profiles/` are temporary and must not be committed. `bun run build-wasm`, `bun run build/ci`,
and the release build regenerate the parsers before compiling them.

`bun run test` runs:

- the corpus in `test/corpus`, with the native build and with the Wasm build (the first run downloads the WASI SDK);
- an incremental-parsing check (`test/unit/incremental.test.ts`): `script/fuzz-corpus` runs `tree-sitter fuzz`, which
  edits each corpus case at random, reparses it, undoes the edits, and reparses again. `TREE_SITTER_SEED`,
  `TREE_SITTER_ITERATIONS`, and `TREE_SITTER_EDITS` run other or more edits. It skips the eleven cases that
  upstream's own parser also reparses differently from a fresh parse (see `script/fuzz-corpus`);
- a check that the real-world Haskell files in `examples/`, the checked-in ones and those of the cloned repositories, fail to
  parse exactly as listed in `script/known-failures.txt`; upstream's prebuilt parser fails on the same files. The first run clones the repositories. The example repositories are pinned to commits in
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
