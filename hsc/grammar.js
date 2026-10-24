const haskell = require('../grammar.js');
const literal = require('../grammar/literal.js');
const lexeme = require('../grammar/lexeme.js');

const braced = ($, close) =>
  seq(
    $._cond_hsc_hash,
    '#',
    optional($._hsc_name_space),
    token.immediate('{'),
    $._cmd_hsc_brace_open,
    optional($._hsc_braced_space),
    field('name', $.hsc_directive_name),
    field('body', alias($.hsc_args_nested, $.hsc_args)),
    close,
    $._cmd_brace_close
  );

module.exports = grammar(haskell, {
  name: 'hsc',

  externals: ($, previous) => [
    ...previous.slice(0, -1),
    $._cmd_hsc_brace_open,
    $._cond_hsc_hash,
    $.hsc_args_nested,
    $.hsc_args_newline,
    previous[previous.length - 1],
  ],

  conflicts: ($, previous) => [...previous, [$._foreign_safety, $.entity]],

  rules: {
    ...literal(/(?:##){1,2}/),
    ...lexeme('##'),

    _operator_hash_head: (_) =>
      seq(choice('##', token.immediate('##')), optional(choice(token.immediate('##'), token.immediate('|')))),

    _foreign_calling_convention: ($, previous) => choice(previous, $.hsc),
    _foreign_safety: ($, previous) => choice(previous, $.hsc),
    _ie_entity: ($, previous) => choice(previous, $.hsc),
    entity: ($, previous) => choice(previous, $.hsc),
    literal: ($, previous) => choice(previous, $._hsc_literal),
    _var: ($, previous) => choice(previous, $.hsc),
    _tycon: ($, previous) => choice(previous, $.hsc),
    _decl_con: ($, previous) => choice(previous, $.hsc),
    _decl_constructor: ($, previous) => choice(previous, $.hsc),

    hsc: ($) =>
      choice(
        braced($, '}'),
        seq(
          $._cond_hsc_hash,
          '#',
          optional($._hsc_name_space),
          field('name', $.hsc_directive_name),
          field('body', alias($.hsc_args_newline, $.hsc_args))
        )
      ),
    _hsc_literal: ($) => braced($, choice('}##', '}####')),
    _hsc_name_space: (_) => token.immediate(/(?:[\t\v\f\r\p{Zs}\x85\u2028\u2029]|\\\r?\n)+/),
    _hsc_braced_space: (_) => token.immediate(/(?:\p{White_Space}|\\\r?\n)+/),
    hsc_directive_name: (_) => token.immediate(prec(-1, /[\pL_](?:[\pL\pN_]|\\\r?\n)*/)),
  },
});
