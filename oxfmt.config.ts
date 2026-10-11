// wbfy:start oxfmt-base
import type { OxfmtConfig } from 'oxfmt';

// oxlint-disable unicorn/prefer-module -- Oxfmt config files are only auto-discovered as .ts, and CommonJS avoids ESM package loading issues.
const oxfmtConfig = require('@willbooster/oxfmt-config');

const oxfmtResolvedConfig: OxfmtConfig = oxfmtConfig.default ?? oxfmtConfig;
// wbfy:end oxfmt-base

// `tree-sitter generate` writes src/ and `tree-sitter init` writes bindings/ in their own style. grammar.js and
// grammar/ keep upstream's text except for the lines README.md lists under "Differences from upstream", so that `diff`
// against upstream shows exactly those lines.
oxfmtResolvedConfig.ignorePatterns = [
  ...(oxfmtResolvedConfig.ignorePatterns ?? []),
  'bindings/**',
  'grammar.js',
  'grammar/**',
  'src/**',
];

// wbfy:start oxfmt-export
module.exports = oxfmtResolvedConfig;
// wbfy:end oxfmt-export
