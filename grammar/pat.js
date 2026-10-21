const {
  sep1,
  sep2,
  sep,
  parens,
  braces,
  brackets,
  unboxed_tuple_full,
  unboxed_sum_single,
} = require('./util.js')

const patternRules = (name, recordField) => {
  const rule = ($, key) => $[name(key)]
  return {

    // ------------------------------------------------------------------------
    // tuples and parens
    // ------------------------------------------------------------------------

    [name('_pat_parens')]: $ => parens($, field('pattern', rule($, '_pat_texp'))),

    [name('_pat_tuple_elems')]: $ => sep2(',', field('element', rule($, '_pat_texp'))),

    [name('_pat_tuple')]: $ => parens($, rule($, '_pat_tuple_elems')),

    [name('_pat_unboxed_tuple')]: $ => unboxed_tuple_full($, rule($, '_pat_texp')),

    [name('_pat_unboxed_sum')]: $ => unboxed_sum_single($, rule($, '_pat_texp')),

    [name('_pat_list')]: $ => brackets($, sep1(',', field('element', rule($, '_pat_texp'))), optional(',')),

    // ------------------------------------------------------------------------
    // record
    // ------------------------------------------------------------------------

    [name('_pat_record')]: $ => prec('record', seq(
      field('constructor', rule($, 'pattern_operand')),
      braces($, sep(',', field('field', recordField($)))),
    )),

    // ------------------------------------------------------------------------
    // misc
    // ------------------------------------------------------------------------

    /**
     * This dynamic precedence penalty is relevant for the conflict between `function` and `bind`.
     * Consider:
     *
     * > f (A a) = exp
     *
     * Because of the "single choice disambiguated with named precedences" approach used for `pattern_operand`, the left node in
     * `pat_apply` can be a variable, even though it's not valid Haskell.
     * While the static prec 'pat-name' covers this at generation time, Haskell's ambiguity requires us to use a runtime
     * conflict for `function`/`bind`, where static prec is ineffective.
     * Giving the reduction of `_var` to `pattern_operand` a strong negative dynamic prec ensures that the runtime branch for
     * `bind` has lower precedence because of `f`, so `function` always wins.
     *
     * While `bind` usually has a lower score than `function` anyway in this situation because it is slightly more
     * complex, there are never any guarantees for runtime conflicts.
     * In particular, the presence of minor parse errors later in the declaration can tip the scales randomly.
     */
    [name('_pat_name')]: $ => choice(
      prec('pat-name', prec.dynamic(-1000, $._var)),
      $._cons,
    ),

    [name('_pat_as')]: $ => prec('prefix', seq(field('bind', $.variable), $._tight_at, field('pattern', rule($, 'pattern_operand')))),

    [name('_pat_wildcard')]: _ => '_',

    [name('_pat_strict')]: $ => prec('prefix', seq($._any_prefix_bang, field('pattern', rule($, 'pattern_operand')))),

    [name('_pat_irrefutable')]: $ => prec('prefix', seq($._any_prefix_tilde, field('pattern', rule($, 'pattern_operand')))),

    // ------------------------------------------------------------------------
    // application
    // ------------------------------------------------------------------------

    [name('_pat_apply_arg')]: $ => choice(
      rule($, 'pattern_operand'),
      alias($._at_type, $.type_binder),
      $.explicit_type,
    ),

    [name('_pat_apply')]: $ => prec.left('apply', seq(
      field('function', rule($, 'pattern_operand')),
      field('argument', rule($, '_pat_apply_arg')),
    )),

    // ------------------------------------------------------------------------
    // operators
    // ------------------------------------------------------------------------

    [name('_pat_negation')]: $ => seq('-', field('number', $._number)),

    [name('_pat_infix_operator')]: $ => seq(
      optional($._cond_no_section_op),
      field('operator', choice(
        $.constructor_operator,
        $._conids_ticked,
        seq($._cond_qualified_op, $._qconsym),
      )),
    ),

    [name('_pat_infix_chain')]: $ => prec.right('infix', seq(
      field('operand', rule($, 'pattern_operand')),
      repeat1(prec.right('infix', seq(rule($, '_pat_infix_operator'), field('operand', rule($, 'pattern_operand'))))),
    )),

    // ------------------------------------------------------------------------
    // top level
    // ------------------------------------------------------------------------

    [name('pattern_operand')]: $ => choice(
      alias(rule($, '_pat_negation'), $.negation),
      alias(rule($, '_pat_apply'), $.apply),
      rule($, '_pat_name'),
      alias(rule($, '_pat_as'), $.as),
      alias(rule($, '_pat_record'), $.record),
      alias(rule($, '_pat_wildcard'), $.wildcard),
      alias(rule($, '_pat_parens'), $.parens),
      alias(rule($, '_pat_tuple'), $.tuple),
      alias(rule($, '_pat_unboxed_tuple'), $.unboxed_tuple),
      alias(rule($, '_pat_unboxed_sum'), $.unboxed_sum),
      alias(rule($, '_pat_list'), $.list),
      alias($._plist, $.list),
      alias(rule($, '_pat_strict'), $.strict),
      alias(rule($, '_pat_irrefutable'), $.irrefutable),
      $._universal,
    ),

    [name('pattern')]: $ => choice(
      alias(rule($, '_pat_infix_chain'), $.infix_chain),
      rule($, 'pattern_operand'),
    ),

    [name('_pat_signature')]: $ => prec.right('annotated', seq(
      field('pattern', rule($, 'pattern')),
      $._type_annotation,
    )),

    [name('_pat')]: $ => choice(
      alias(rule($, '_pat_signature'), $.signature),
      prec.right(rule($, 'pattern')),
    ),

    [name('view_pattern')]: $ => seq(field('expression', $._exp), $._arrow, field('pattern', rule($, '_pat_texp'))),

    [name('_pat_texp')]: $ => choice(
      alias(rule($, 'view_pattern'), $.view_pattern),
      rule($, '_pat'),
    ),

  }
}

const bindingRuleName = name => {
  if (['_pat_negation', '_pat_wildcard'].includes(name)) return name
  if (name === 'view_pattern') return '_binding_view_pattern'
  return name.startsWith('_') ? `_binding${name}` : `binding_${name}`
}

const recordField = ($, pattern) => choice(
  alias('..', $.wildcard),
  seq(field('field', $._field_names), optional(seq('=', field('pattern', pattern)))),
)

module.exports = {
  ...patternRules(name => name, $ => $.field_pattern),
  ...patternRules(bindingRuleName, $ => $.binding_field_pattern),

  binding_field_pattern: $ => choice(alias($._binding_field_pattern, $.field_pattern)),
  _binding_field_pattern: $ => recordField($, $._binding_pat_texp),
  field_pattern: $ => recordField($, $._pat_texp),
  patterns: $ => repeat1(prec('patterns', $._pat_apply_arg)),
}
