const { sep1, sep, parens, semi, semi_opt, semis } = require('./util.js');

const declaration = ($, bindings) =>
  choice(
    bindings,
    $.type_synonym,
    $.kind_signature,
    $.type_family,
    $.type_instance,
    $.role_annotation,
    $.data_type,
    $.newtype,
    $.data_family,
    $.data_instance,
    $.class,
    $.instance,
    $.default_types,
    $.deriving_instance,
    $.pattern_synonym,
    $.foreign_import,
    $.foreign_export,
    $.fixity,
    $.top_splice
  );

module.exports = {
  // ------------------------------------------------------------------------
  // module names
  // ------------------------------------------------------------------------

  _modid: ($) => alias($.name, $.module_id),

  _modid_prefix: ($) => prec('qualifying-module', seq($._modid, $._any_tight_dot)),

  _qualifying_module: ($) => repeat1($._modid_prefix),

  module: ($) => seq(repeat($._modid_prefix), $._modid),

  // ------------------------------------------------------------------------
  // import/export
  // ------------------------------------------------------------------------

  namespace: (_) => choice('pattern', 'type'),

  _ie_value: ($) => choice(field('variable', $._varids), field('operator', choice($._sym_prefix, $._pqsym))),

  _ie_name: ($) => choice($._ie_value, field('type', $._tyconids)),

  _ie_data: ($) =>
    seq(
      field('namespace', alias('data', $.namespace)),
      choice($._ie_value, field('constructor', choice($._qconid, $._constructor)))
    ),

  _child_namespaced: ($) => choice(seq(field('namespace', alias('type', $.namespace)), $._ie_name), $._ie_data),

  _child: ($) => choice(alias($._child_namespaced, $.namespaced_child), $._qname),

  children: ($) => parens($, sep(',', field('element', choice(alias('..', $.all_names), $._child)))),

  _ie_entity: ($) =>
    choice(
      seq(optional(field('namespace', $.namespace)), $._ie_name, optional(field('children', $.children))),
      $._ie_data
    ),

  // ------------------------------------------------------------------------
  // import
  // ------------------------------------------------------------------------

  import_list: ($) => parens($, sep(',', field('name', alias($._ie_entity, $.import_name))), optional(',')),

  import_level: (_) => choice('splice', 'quote'),

  _import_module: ($) =>
    seq(
      optional('safe'),
      optional('qualified'),
      optional(field('package', alias($.string, $.import_package))),
      field('module', $.module)
    ),

  import: ($) =>
    seq(
      'import',
      choice(
        seq(field('level', $.import_level), $._import_module),
        seq($._import_module, optional(field('level', $.import_level)))
      ),
      optional('qualified'),
      optional(seq('as', field('alias', $.module))),
      optional(seq(optional('hiding'), field('names', $.import_list)))
    ),

  // ------------------------------------------------------------------------
  // export
  // ------------------------------------------------------------------------

  module_export: ($) => seq('module', field('module', $.module)),

  default_export: ($) => seq('default', field('class', $._tyconids)),

  exports: ($) =>
    parens(
      $,
      optional(sep1(',', choice(field('export', alias($._ie_entity, $.export)), $.module_export, $.default_export))),
      optional(',')
    ),

  // ------------------------------------------------------------------------
  // module body / sections
  // ------------------------------------------------------------------------

  header: ($) => seq('module', field('module', $.module), field('exports', optional($.exports)), $._where),

  imports: ($) => seq(semis($, field('import', $.import)), semi($)),

  /**
   * Using `semi` at the end instead of `semi_opt` increases parser size by a full megabyte!!
   *
   * This allows imports after the first declaration to prevent the tree from jittering while typing an import:
   *
   * > import A
   * > imp
   * > import B
   *
   * The partially typed `imp` will be parsed as a `top_splice`, which forces `imports` to reduce after `import A`.
   * The rest of the file will then be part of `declarations` and all following imports will be broken until the keyword
   * has been completed.
   */
  declarations: ($) => seq($.declaration, repeat(seq(semi($), choice($.declaration, $.import))), semi_opt($)),

  _body: ($) =>
    seq(
      choice($._cmd_layout_start, alias($._cmd_layout_start_explicit, '{')),
      semi_opt($),
      field('imports', optional($.imports)),
      field('declarations', optional($.declarations)),
      $._layout_end
    ),

  _layout_end: ($) => choice($._cond_layout_end, alias($._cond_layout_end_explicit, '}')),

  declaration: ($) => declaration($, $._module_decl),

  _quoted_declaration: ($) => declaration($, $.decl),
};
