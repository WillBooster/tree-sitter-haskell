module.exports = {

  conflicts: $ => [
    // GHC DisambECP (notes Ambiguous syntactic categories, PatBuilder and Declaration/signature overlap)
    // disambiguates expressions, patterns and declaration heads after parsing; these alternatives must remain
    // available until following syntax determines their role, including for top-level expression splices.
    [$._function_name, $.pattern],
    [$._function_name, $.pattern, $.expression],
    [$._grouped_name, $._function_name, $.pattern, $.expression],
    [$._grouped_name, $.expression],
    [$._grouped_name, $.pattern, $.expression],
    [$._grouped_name, $.expression, $.pattern, $._function_name, $._binding_name_parens],
    [$.pattern, $._function_name, $._binding_name_parens],
    [$.pattern, $._binding_name_parens],
    [$._grouped_name, $.expression, $.pattern, $._binding_name_parens],
    [$.pattern, $.expression],
    [$.signature, $.pattern],
    // The hash opening an unboxed tuple can also begin a symbolic operator.
    [$._operator_hash_head, $._unboxed_open],
  ],

}
