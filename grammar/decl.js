const {
  sep1,
  sep2,
  parens,
  layout,
} = require('./util.js')

const foreignMacro = /[A-Z][A-Za-z_0-9]*/

const binding = ($, pattern) => prec('bind', seq(
  choice(
    field('pattern', pattern),
    field('name', $._var),
    field('name', alias($._binding_name_parens, $.parenthesized_name)),
    field('implicit', $.implicit_variable),
  ),
  $._bind_matches,
))

module.exports = {

  _fun_arrow_prec: _ => seq('-', '1'),

  // GHC.Types special decl
  _fun_arrow_fixity: $ => seq(
    field('associativity', 'infixr'),
    field('precedence', alias($._fun_arrow_prec, $.integer)),
    field('operator', alias('->', $.operator)),
  ),

  fixity: $ => choice(
    $._fun_arrow_fixity,
    seq(
      field('associativity', choice('infixl', 'infixr', 'infix')),
      field('precedence', optional($.integer)),
      optional(field('namespace', alias(choice('type', 'data'), $.namespace))),
      field('operator', sep1(',', choice($._operator_minus, $._varop, $._conop))),
    ),
  ),

  _con_binding_list: $ => sep2(',', field('name', $._con)),

  _var_binding_list: $ => sep2(',', field('name', $._var)),

  signature: $ => seq(
    choice(
      field('name', $._var),
      field('names', alias($._var_binding_list, $.binding_list)),
    ),
    $._type_annotation,
  ),

  _simple_bind_match: $ => seq('=', field('expression', $._exp)),

  _bind_match: $ => seq(
    $._guards,
    '=',
    $._cmd_texp_end,
    field('expression', $._exp),
  ),

  _bind_matches: $ => seq(
    choice(
      field('match', alias($._simple_bind_match, $.match)),
      repeat1(field('match', alias($._bind_match, $.match))),
    ),
    optional($._where_binds),
  ),

  _function_name: $ => field('name', $._var),

  _function_head_parens: $ => parens(
    $,
    choice(
      $._function_head,
      $._function_head_patterns,
    ),
  ),

  _function_head_patterns: $ => choice(
    $._function_name,
    $._function_head_parens,
  ),

  _function_head_infix: $ => seq(
    field('left_operand', $.pattern),
    optional($._cond_no_section_op),
    field('operator', choice(seq($._cond_minus, $._operator_minus), $._varop)),
    field('right_operand', $.pattern),
  ),

  _function_head: $ => choice(
    seq($._function_head_patterns, field('patterns', $.patterns)),
    field('head', alias($._function_head_infix, $.infix)),
  ),

  function: $ => seq(
    $._function_head,
    $._bind_matches,
  ),

  _binding_name_parens: $ => parens($, choice($._var, $._binding_name_parens)),

  bind: $ => binding($, $._pat),

  _module_bind: $ => binding($, $._binding_pat),

  _module_decl: $ => choice(
    $.signature,
    $.function,
    alias($._module_bind, $.bind),
  ),

  decl: $ => choice(
    $.signature,
    $.function,
    $.bind,
  ),

  _local_decl: $ => choice(
    $.fixity,
    $.decl,
  ),

  local_binds: $ => layout($, field('decl', $._local_decl)),

  _where_binds: $ => seq($._where, optional(field('binds', $.local_binds))),

  _foreign_calling_keyword: _ => token(choice(
    'ccall',
    'stdcall',
    'capi',
    'prim',
    'javascript',
  )),

  _foreign_safety_keyword: _ => token(choice(
    'unsafe',
    'safe',
    'interruptible',
  )),

  _foreign_macro: _ => token(prec(-1, foreignMacro)),

  _foreign_underscore_identifier: _ => token(/_[A-Za-z_0-9]+/),

  _foreign_calling_convention: $ => choice(
    alias('_', $.calling_convention),
    alias($._foreign_calling_keyword, $.calling_convention),
    alias($._foreign_macro, $.calling_convention),
    alias($._foreign_underscore_identifier, $.calling_convention),
  ),

  _foreign_safety: $ => choice(
    alias('_', $.safety),
    alias($._foreign_safety_keyword, $.safety),
    alias($._foreign_macro, $.safety),
    alias($._foreign_underscore_identifier, $.safety),
  ),

  _foreign_underscore_signature: $ => seq(
    field('name', alias($._foreign_underscore_identifier, $.variable)),
    $._type_annotation,
  ),

  _foreign_signature: $ => choice(
    $.signature,
    alias($._foreign_underscore_signature, $.signature),
  ),

  entity: $ => $.string,

  foreign_import: $ => seq(
    'foreign',
    'import',
    field('calling_convention', $._foreign_calling_convention),
    optional(field('safety', $._foreign_safety)),
    optional(field('entity', $.entity)),
    field('signature', $._foreign_signature),
  ),

  foreign_export: $ => seq(
    'foreign',
    'export',
    field('calling_convention', $._foreign_calling_convention),
    optional(field('entity', $.entity)),
    field('signature', $._foreign_signature),
  ),

  default_types: $ => seq('default', parens($, optional(sep1(',', field('type', $._ktype))))),

}
