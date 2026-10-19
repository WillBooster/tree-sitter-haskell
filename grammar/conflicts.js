module.exports = {

  conflicts: $ => [
    // GHC disambiguates expressions, patterns and declaration heads after parsing; these alternatives must remain
    // available until following syntax determines their role, including for top-level expression splices.
    [$._function_name, $.pattern],
    [$._function_name, $.pattern, $.expression],
    [$._callee_name, $._function_name, $.pattern, $.expression],
    [$._callee_name, $.expression],
    [$._callee_name, $.pattern, $.expression],
    [$.pattern, $.expression],
    [$.signature, $.pattern],
    [$._operator_hash_head, $._unboxed_open],
  ],

}
