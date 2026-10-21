; NOTE: These are at the top, so that they have low priority,
; and don't override destructured parameters
(variable) @variable

[(pattern/wildcard) (binding_pattern/wildcard)] @variable

(function
  patterns: (patterns
    (_) @variable.parameter))

(expression/lambda
  (_)+ @variable.parameter
  "->")

(function
  (infix
    (pattern) @variable.parameter))

(integer) @number

(negation) @number

(expression/literal
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
  type: (type))

((signature
  name: (variable) @_name
  type: (type))
  .
  [
    (function name: (variable) @variable)
    (bind name: (variable) @variable)
  ]
    match: (_)
  (#eq? @_name @variable))

(signature
  name: (variable) @function
  type: (type/apply
    constructor: (name) @_type)
  (#eq? @_type "IO"))

((signature
  name: (variable) @_name
  type: (type/apply
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
    expression: (expression/lambda)))

(view_pattern
  [
    (expression/variable) @function.call
    (expression/qualified
      (variable) @function.call)
  ])

(infix_id
  [
    (variable) @operator
    (qualified
      (variable) @operator)
  ])

(infix
  [
    (variable) @function.call
    (qualified
      ((module) @module
        (variable) @function.call))
  ]
  .
  (operator))

((expression/variable) @variable
  .
  (operator))

((operator)
  .
  [
    (expression/variable) @variable
    (expression/qualified
      (variable) @variable)
  ])

([
    (expression/variable) @function.call
    (expression/qualified
      (variable) @function.call)
  ]
  .
  (operator) @_op
  (#any-of? @_op "$" "<$>" ">>=" "=<<"))

((infix
  [
    (operator)
    (infix_id (variable))
  ]
  .
  [
    (variable) @function.call
    (qualified
      (variable) @function.call)
  ])
  .
  (operator) @_op
  (#any-of? @_op "$" "<$>" "=<<"))

(
  [
    (expression/variable) @function
    (expression/qualified
      (variable) @function)
  ]
  .
  (operator) @_op
  (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))

((infix
  [
    (operator)
    (infix_id (variable))
  ]
  .
  [
    (variable) @function
    (qualified
      (variable) @function)
  ])
  .
  (operator) @_op
  (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))

((operator) @_op
  .
  [
    (expression/variable) @function
    (expression/qualified
      (variable) @function)
  ]
  (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))

(function
  name: (variable) @function
  (match
    expression: (infix
      operator: (operator) @_op
      (#any-of? @_op "." ">>>" "***" ">=>" "<=<"))))

(apply
  [
    (expression/variable) @function.call
    (expression/qualified
      (variable) @function.call)
  ])

(apply
  .
  (expression/parens
    (infix
      [
        (variable) @function.call
        (qualified
          (variable) @function.call)
      ]
      .
      (operator))))

(apply
  .
  (expression/parens
    (infix
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
    (expression/variable) @variable
    (expression/qualified
      (variable) @variable)
  ])

(bind
  name: (variable) @function
  (#eq? @function "main"))

(signature
  pattern: [(pattern/variable) (binding_pattern/variable)] @function
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

(type/star) @type

[
  (type/variable)
  (constraint/variable)
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

(expression/apply
  function: (parenthesized_name
    [
      (variable) @function.call
      (qualified id: (variable) @function.call)
    ]))
