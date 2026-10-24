const { parens, brackets, unboxed, quoted_string, string_gap } = require('./util.js');

const decimal = /[0-9][0-9_]*/;
const exponent = /[eE][+-]?[0-9_]+/;
const hex_exponent = /[pP][+-]?[0-9a-fA-F_]+/;

module.exports = (hashSuffix = /##?/) => {
  const magic_hash = (rule) => token(seq(rule, optional(token.immediate(hashSuffix))));
  return {
    float: (_) => magic_hash(seq(decimal, choice(seq(/\.[0-9_]+/, optional(exponent)), exponent))),

    char: (_) => magic_hash(choice(/'[^'\r\n\f]'/, seq("'\\", choice("'", /[^'\p{White_Space}]+/), "'"))),

    string: (_) =>
      magic_hash(
        choice(
          quoted_string(/[^\\"\n]/, /\\(\^)?./),
          seq(
            '"""',
            repeat(seq(optional(/""?/), choice(/[^\\"]/, /\\(?:\^[@-_]|[^\p{White_Space}^])/, string_gap))),
            '"""'
          )
        )
      ),

    _integer_literal: (_) => magic_hash(decimal),
    _binary_literal: (_) => magic_hash(/0[bB][01_]+/),
    _octal_literal: (_) => magic_hash(/0[oO][0-7]+/),

    _hex_literal: (_) => magic_hash(seq(/0[xX][0-9a-fA-F_]+/, optional(/\.[0-9a-fA-F_]+/), optional(hex_exponent))),

    integer: ($) => choice($._sized_integer, $._binary_literal, $._integer_literal, $._octal_literal, $._hex_literal),

    _stringly: ($) => choice($.string, $.char),

    _number: ($) => choice($.integer, $.float),

    _plist: ($) => brackets($),

    unit: ($) => parens($),
    unboxed_unit: ($) => unboxed($),

    prefix_tuple: ($) => parens($, repeat1(',')),
    prefix_unboxed_tuple: ($) => unboxed($, repeat1(',')),
    prefix_unboxed_sum: ($) => unboxed($, repeat1($._unboxed_bar)),

    literal: ($) => choice($._stringly, $._number),

    _unit_cons: ($) => choice($.unit, $.unboxed_unit),

    _tuple_cons: ($) => choice($.prefix_tuple, $.prefix_unboxed_tuple, $.prefix_unboxed_sum),
  };
};
