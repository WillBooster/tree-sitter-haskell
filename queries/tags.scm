(header module: (module) @name) @definition.module

(declarations
  [
    (function name: [(variable) @name (prefix_id (operator) @name)])
    (function head: (infix operator: [(operator) @name (infix_id (variable) @name)]))
    (signature name: [(variable) @name (prefix_id (operator) @name)])
    (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
  ] @definition.function)

(declarations
  (bind name: [
    (variable) @name
    (prefix_id (operator) @name)
    (parenthesized_name [(variable) @name (prefix_id (operator) @name)])
  ]) @definition.variable)

(binding_pattern/variable) @name @definition.variable
(binding_pattern/prefix_id (operator) @name) @definition.variable
(binding_pattern/as bind: (variable) @name) @definition.variable

(binding_field_pattern/field_pattern
  !pattern
  field: [(field_name) @name (qualified id: (field_name) @name)]) @definition.variable

[
  (class_declarations
    [
      (function name: [(variable) @name (prefix_id (operator) @name)])
      (function head: (infix operator: [(operator) @name (infix_id (variable) @name)]))
      (signature name: [(variable) @name (prefix_id (operator) @name)])
      (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
      (default_signature signature: (signature name: [(variable) @name (prefix_id (operator) @name)]))
      (default_signature signature: (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)])))
      (bind name: [
        (variable) @name
        (prefix_id (operator) @name)
        (parenthesized_name [(variable) @name (prefix_id (operator) @name)])
      ])
    ] @definition.method)
  (instance_declarations
    [
      (function name: [(variable) @name (prefix_id (operator) @name)])
      (function head: (infix operator: [(operator) @name (infix_id (variable) @name)]))
      (signature name: [(variable) @name (prefix_id (operator) @name)])
      (signature names: (binding_list name: [(variable) @name (prefix_id (operator) @name)]))
      (bind name: [
        (variable) @name
        (prefix_id (operator) @name)
        (parenthesized_name [(variable) @name (prefix_id (operator) @name)])
      ])
    ] @definition.method)
]

[
  (type_synonym name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ])
  (type_family name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ])
  (data_family name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ])
] @definition.class

[
  (type_synonym head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
  (type_family head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
  (data_family head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
] @definition.class

(declarations
  [
    (data_type name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ])
    (newtype name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ])
    (data_type head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
    (newtype head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)]))
  ] @definition.class)

(class name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ]) @definition.interface
(class head: (infix operator: [(constructor_operator) @name (operator) @name (infix_id (name) @name)])) @definition.interface
(instance name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ]) @reference.implementation
(instance head: (infix operator: [
  (constructor_operator) @name
  (operator) @name
  (infix_id (name) @name)
  (qualified id: [(constructor_operator) @name (operator) @name])
  (infix_id (qualified id: (name) @name))
])) @reference.implementation

(deriving_instance name: [
    (name) @name
    (qualified id: (name) @name)
    (prefix_id [(operator) @name (constructor_operator) @name])
    (prefix_id (qualified id: [(operator) @name (constructor_operator) @name]))
  ]) @reference.implementation
(deriving_instance head: (infix operator: [
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
    (parenthesized_name [
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
