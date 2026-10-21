module.exports = {

  precedences: $ => [

    // ------------------------------------------------
    // associativity of expressions, patterns and types
    // ------------------------------------------------

    [
      'projection',
      'record',
      'prefix',
      'apply',
      'infix',
      'implicit',
      'fun',
      'annotated',
      $.quantified_type,
    ],

    // ------------------------------------------------
    // negation
    // ------------------------------------------------

    [
      $._pat_negation,
      $.literal,
    ],

    // ------------------------------------------------
    // function vs bind
    // ------------------------------------------------

    [
      'bind',
      'pat-name',
    ],

    // ------------------------------------------------
    // qualified names
    // ------------------------------------------------

    // Shift a tight dot before reducing a qualified constructor or module.
    [
      'qualifying-module',
      'qualified-id',
    ],

    // Prefer a qualified variable over record-field projection on a constructor.
    [
      'qualifying-module',
      'con',
    ],

    // Prefer a qualified type name over an infix dot operator.
    [
      'qualifying-module',
      'type-name',
    ],

    // ------------------------------------------------
    // types and constraints
    // ------------------------------------------------

    [
      $.operator,
      $._type_star,
    ],

    [
      $._type_wildcard,
      $._type_param_wildcard,
    ],

    [
      $._constructor_ticked,
      $._tycon_ticked,
    ],

    [
      'qtype-single',
      'qtype-curried',
    ],

    // ------------------------------------------------
    // misc
    // ------------------------------------------------

    /**
     * > f A a a = a
     * > data A = A Int Int
     *
     * This should not be parsed as constructor application, but separate patterns.
     */
    [
      'patterns',
      'apply',
    ],

    [$._grouped_name, $.parenthesized_name, $._exp_parens],

  ],

}
