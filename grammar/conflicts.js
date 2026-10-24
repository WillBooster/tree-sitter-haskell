module.exports = {
  conflicts: ($) => [
    // GHC DisambECP (notes Ambiguous syntactic categories, PatBuilder and Declaration/signature overlap)
    // disambiguates expressions, patterns and declaration heads after parsing; these alternatives must remain
    // available until following syntax determines their role, including for top-level expression splices.
    [$.expression_operand, $.pattern_operand, $.binding_pattern_operand],
    [$.expression_operand, $.pattern_operand],
    [$.expression_operand, $.binding_pattern_operand],
    [$.pattern_operand, $.binding_pattern_operand],
    [$.prefix_negation, $._pat_negation],
    [$._type_apply, $._type_infix_chain],
    [$._type_infix_chain],
    [$._grouped_name, $.expression_operand, $.pattern_operand, $._binding_name_parens],
    [$.pattern_operand, $._binding_name_parens],
    [$._grouped_name, $.expression_operand, $.pattern_operand, $._function_name, $._binding_name_parens],
    [$._grouped_name, $.expression_operand, $.binding_pattern_operand],
    [$._grouped_name, $.expression_operand, $.pattern_operand],
    [$.pattern_operand, $._function_name, $._binding_name_parens],
    [$._grouped_name, $.expression_operand, $.pattern_operand, $.binding_pattern_operand],
    [$.pattern_operand, $.signature],
    [$.pattern_operand, $._function_name],
    [$.expression_operand, $.pattern_operand, $._function_name],
    [$._grouped_name, $.expression_operand],
    [
      $._grouped_name,
      $.expression_operand,
      $.pattern_operand,
      $.binding_pattern_operand,
      $._function_name,
      $._binding_name_parens,
    ],
    [$.binding_pattern_operand, $.signature],
    [$.pattern_operand, $.binding_pattern_operand, $._function_name],
    [$.expression_operand, $.pattern_operand, $.binding_pattern_operand, $._function_name],
    // The hash opening an unboxed tuple can also begin a symbolic operator.
    [$._operator_hash_head, $._unboxed_open],
  ],
};
