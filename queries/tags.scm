(header module: (module) @name) @definition.module

(declarations
  [
    (function name: [(variable) @name (prefix_id (operator) @name)])
    (function (infix operator: [(operator) @name (infix_id (variable) @name)]))
    (signature name: [(variable) @name (prefix_id (operator) @name)])
    (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
  ] @definition.function)

(declarations
  (bind name: [(variable) @name (prefix_id (operator) @name)]) @definition.variable)

[
  (class_declarations
    [
      (function name: [(variable) @name (prefix_id (operator) @name)])
      (function (infix operator: [(operator) @name (infix_id (variable) @name)]))
      (signature name: [(variable) @name (prefix_id (operator) @name)])
      (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
      (default_signature signature: (signature name: [(variable) @name (prefix_id (operator) @name)]))
      (default_signature signature: (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)])))
      (bind name: [(variable) @name (prefix_id (operator) @name)])
    ] @definition.method)
  (instance_declarations
    [
      (function name: [(variable) @name (prefix_id (operator) @name)])
      (function (infix operator: [(operator) @name (infix_id (variable) @name)]))
      (signature name: [(variable) @name (prefix_id (operator) @name)])
      (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
      (bind name: [(variable) @name (prefix_id (operator) @name)])
    ] @definition.method)
]

[
  (type_synonym name: (_) @name)
  (type_family name: (_) @name)
  (data_family name: (_) @name)
] @definition.class

[
  (type_synonym (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]) "=")
  (type_family (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
  (data_family (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
] @definition.class

(declarations
  [
    (data_type name: (_) @name)
    (newtype name: (_) @name)
    (data_type (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
    (newtype (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
  ] @definition.class)

(class name: (_) @name) @definition.interface
(class (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)])) @definition.interface
(instance name: (_) @name) @reference.implementation
(instance (infix operator: [
  (constructor_operator) @name
  (operator) @name
  (infix_id (name) @name)
  (qualified id: [(constructor_operator) @name (operator) @name])
  (infix_id (qualified id: (name) @name))
])) @reference.implementation

(deriving_instance name: (_) @name) @reference.implementation
(deriving_instance (infix operator: [
  (constructor_operator) @name
  (operator) @name
  (infix_id (name) @name)
  (qualified id: [(constructor_operator) @name (operator) @name])
  (infix_id (qualified id: (name) @name))
])) @reference.implementation

(foreign_import
  signature: (signature name: [(variable) @name (prefix_id (operator) @name)])) @definition.function

(expression/apply
  function: [
    (variable) @name
    (qualified id: (variable) @name)
    (prefix_id (operator) @name)
    (prefix_id (qualified id: (operator) @name))
    (parens expression: [
      (variable) @name
      (qualified id: (variable) @name)
      (prefix_id (operator) @name)
      (prefix_id (qualified id: (operator) @name))
    ])
  ]) @reference.call

(expression/infix
  operator: [
    (operator) @name
    (infix_id (variable) @name)
    (infix_id (qualified id: (variable) @name))
    (qualified id: (operator) @name)
  ]) @reference.call
