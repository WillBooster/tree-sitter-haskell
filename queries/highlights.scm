; NOTE: These are at the top, so that they have low priority,
; and don't override destructured parameters
(variable) @variable

[(pattern_operand/wildcard) (binding_pattern_operand/wildcard)] @variable

(function
  patterns: (patterns
    (_) @variable.parameter))

(expression_operand/lambda
  (_)+ @variable.parameter
  "->")

(function
  (infix
    [(pattern_operand) (infix_chain)] @variable.parameter))

(integer) @number

(negation) @number

(expression_operand/literal
  (float)) @number.float

(char) @character

(string) @string

(unit) @string.special.symbol

(comment) @comment

((haddock) @comment.documentation)

[
  "("
  ")"
  "{"
  "}"
  "["
  "]"
] @punctuation.bracket

[
  ","
  ";"
] @punctuation.delimiter

[
  "forall"
] @keyword.repeat

(pragma) @keyword.directive

[
  "if"
  "then"
  "else"
  "case"
  "cases"
  "of"
] @keyword.conditional

[
  "import"
  "qualified"
  "module"
] @keyword.import

[
  (operator)
  (prefix_negation)
  (constructor_operator)
  (all_names)
  (wildcard)
  (typed_hole)
  "."
  ".."
  "="
  "|"
  "::"
  "=>"
  "->"
  "<-"
  "\\"
  "`"
  "@"
] @operator

(module
  (module_id) @module)

[
  "where"
  "let"
  "in"
  "class"
  "instance"
  "pattern"
  "data"
  "newtype"
  "family"
  "type"
  "as"
  "hiding"
  "deriving"
  "via"
  "stock"
  "anyclass"
  "do"
  "mdo"
  "rec"
  "infix"
  "infixl"
  "infixr"
] @keyword

[
  (function name: (variable) @function)
  (bind name: (variable) @function)
  (signature name: (variable) @function)
  (signature names: (binding_list (variable) @function))
]

(bind
  name: (variable) @variable)

(signature
  name: (variable) @variable
  type: [(type_operand) (infix_chain)])

((signature
  name: (variable) @_name
  type: [(type_operand) (infix_chain)])
  .
  [
    (function name: (variable) @variable)
    (bind name: (variable) @variable)
  ]
    match: (_)
  (#eq? @_name @variable))

(signature
  name: (variable) @function
  type: (type_operand/apply
    constructor: (name) @_type)
  (#eq? @_type "IO"))

((signature
  name: (variable) @_name
  type: (type_operand/apply
    constructor: (name) @_type)
  (#eq? @_type "IO"))
  .
  [
    (function name: (variable) @function)
    (bind name: (variable) @function)
  ]
    match: (_)
  (#eq? @_name @function))

([
  (signature name: (_))
  (signature names: (_))
] @function
  .
  (function
    name: (variable) @function))

(bind
  name: (variable) @function
  (match
    expression: (expression_operand/lambda)))

(view_pattern
  [
    (expression_operand/variable) @function.call
    (expression_operand/qualified
      (variable) @function.call)
  ])

(infix_id
  [
    (variable) @operator
    (qualified
      (variable) @operator)
  ])

(operator_chain
  [
    (variable) @function.call
    (qualified
      ((module) @module
        (variable) @function.call))
  ]
  .
  (operator))

((expression_operand/variable) @variable
  .
  (operator))

((operator)
  .
  [
    (expression_operand/variable) @variable
    (expression_operand/qualified
      (variable) @variable)
  ])

([
    (expression_operand/variable) @function.call
    (expression_operand/qualified
      (variable) @function.call)
  ]
  .
  (operator) @_op
  (#any-of? @_op "$" "<$>" ">>=" "=<<"))

(
  [
    (expression_operand/variable) @function
    (expression_operand/qualified
      (variable) @function)
  ]
  .
  (operator) @_op
  (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))

((operator) @_op
  .
  [
    (expression_operand/variable) @function
    (expression_operand/qualified
      (variable) @function)
  ]
  (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))

(function
  name: (variable) @function
  (match
    expression: (operator_chain
      operator: (operator) @_op
      (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))))

(apply
  [
    (expression_operand/variable) @function.call
    (expression_operand/qualified
      (variable) @function.call)
  ])

(apply
  .
  (expression_operand/parens
    (operator_chain
      [
        (variable) @function.call
        (qualified
          (variable) @function.call)
      ]
      .
      (operator))))

(apply
  .
  (expression_operand/parens
    (operator_chain
      (operator)
      .
      [
        (variable) @function.call
        (qualified
          (variable) @function.call)
      ])))

(apply
  (_)
  .
  [
    (expression_operand/variable) @variable
    (expression_operand/qualified
      (variable) @variable)
  ])

(bind
  name: (variable) @function
  (#eq? @function "main"))

(signature
  pattern: [(pattern_operand/variable) (binding_pattern_operand/variable)] @function
  type: (quantified_type))

(signature
  name: (variable) @function
  type: (quantified_type))

((signature
  name: (variable) @_name
  type: (quantified_type))
  .
  (bind
    (variable) @function)
  (#eq? @function @_name))

(name) @type

(type_operand/star) @type

[
  (type_operand/variable)
  (constraint_operand/variable)
  (type_param/variable)
] @type

(fundep (variable) @type)
(type_family_injectivity (variable) @type)

(constructor) @constructor

((constructor) @boolean
  (#any-of? @boolean "True" "False"))

((variable) @boolean
  (#eq? @boolean "otherwise"))

(quoter) @function.call

(quasiquote
  [
    (quoter) @_name
    (_
      (variable) @_name)
  ]
  (#eq? @_name "qq")
  (quasiquote_body) @string)

(quasiquote
  (_
    (variable) @_name)
  (#eq? @_name "qq")
  (quasiquote_body) @string)

(quasiquote
  (_
    (module) @module
    .
    (variable) @function.call))

(field_name
  (variable) @variable.member)

(import_name
  (name)
  .
  (children
    (variable) @variable.member))

(comment) @spell

(expression_operand/apply
  function: (parenthesized_name
    [
      (variable) @function.call
      (qualified id: (variable) @function.call)
    ]))
