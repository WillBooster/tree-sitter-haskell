const sep1 = (s, rule) => seq(rule, repeat(seq(s, rule)));

const sep2 = (s, rule) => seq(rule, repeat1(seq(s, rule)));

const sep = (s, rule) => optional(sep1(s, rule));

const string_gap = /\\\p{White_Space}+\\/;

const quoted_string = (character, escape) => seq('"', repeat(choice(character, escape, string_gap)), '"');

const parens = ($, ...rule) => seq($._paren_open, ...rule, $._paren_close);

const braces = ($, ...rule) => seq('{', $._cmd_brace_open, ...rule, '}', $._cmd_brace_close);

const brackets = ($, ...rule) => seq($._bracket_open, ...rule, $._bracket_close);

const ticked = (...rule) => seq('`', ...rule, '`');

const promoted = (...rule) => seq("'", ...rule);

const prefix_at = ($, ...rule) => prec('prefix', seq($._prefix_at, ...rule));

const semi = ($) => choice(repeat1(';'), $._cond_layout_semicolon);

const semi_opt = ($) => optional(semi($));

const semis = ($, rule) => sep1(semi($), rule);

const layout_sort_single = ($, start, rule) =>
  seq(choice(start, alias($._cmd_layout_start_explicit, '{')), rule, $._layout_end);

/**
 * The start rule must be a `_cmd_layout_<type>` external so the scanner can push a layout context.
 * Layout-start externals make the scanner record the current column; conditional end and semicolon tokens compare it.
 */
const layout_sort = ($, start, rule) =>
  seq(
    choice(start, alias($._cmd_layout_start_explicit, '{')),
    optional(seq(semi_opt($), semis($, rule), semi_opt($))),
    $._layout_end
  );

/**
 * The scanner emits a layout-start token unconditionally after layout introducers, including single-element alternatives.
 */
const layout_single = ($, rule) => layout_sort_single($, $._cmd_layout_start, rule);

const layout = ($, rule) => layout_sort($, $._cmd_layout_start, rule);

const unboxed = ($, ...rules) => seq($._unboxed_open, ...rules, $._unboxed_close);

const unboxed_tuple_nonempty = ($, rule) =>
  unboxed($, repeat(','), field('element', rule), repeat(seq(',', optional(field('element', rule)))));

const unboxed_tuple_full = ($, rule) => unboxed($, sep1(',', field('element', rule)));

const unboxed_sum_single = ($, rule) =>
  unboxed(
    $,
    choice(seq(repeat1($._unboxed_bar), field('element', rule)), seq(field('element', rule), $._unboxed_bar)),
    repeat($._unboxed_bar)
  );

const unboxed_sum_full = ($, rule) => unboxed($, sep2($._unboxed_bar, field('element', rule)));

const optional_where = ($, rule) => optional(seq($._where, optional(rule)));

const qualified = ($, id) =>
  prec('qualified-id', seq(field('module', alias($._qualifying_module, $.module)), field('id', id)));

const context = ($) => optional(field('context', $.context));

const forall = ($) => optional(field('forall', $._forall));

module.exports = {
  sep1,
  sep2,
  sep,
  quoted_string,
  string_gap,
  parens,
  braces,
  brackets,
  ticked,
  promoted,
  prefix_at,
  semi,
  semi_opt,
  semis,
  layout_sort_single,
  layout_sort,
  layout_single,
  layout,
  unboxed,
  unboxed_tuple_nonempty,
  unboxed_tuple_full,
  unboxed_sum_single,
  unboxed_sum_full,
  optional_where,
  qualified,
  context,
  forall,
};
