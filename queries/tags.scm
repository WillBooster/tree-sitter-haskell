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
      (bind name: [(variable) @name (prefix_id (operator) @name)])
    ] @definition.method)
  (instance_declarations
    [
      (function name: [(variable) @name (prefix_id (operator) @name)])
      (function (infix operator: [(operator) @name (infix_id (variable) @name)]))
      (signature name: [(variable) @name (prefix_id (operator) @name)])
      (bind name: [(variable) @name (prefix_id (operator) @name)])
    ] @definition.method)
]

[
  (data_type name: (_) @name)
  (newtype name: (_) @name)
  (type_synonym name: (_) @name)
  (type_family name: (_) @name)
] @definition.class

(class name: (_) @name) @definition.interface
(instance name: (_) @name) @reference.implementation

(expression/apply
  function: [
    (variable) @name
    (qualified id: (variable) @name)
    (prefix_id (operator) @name)
  ]) @reference.call

(expression/infix
  operator: [
    (operator) @name
    (infix_id (variable) @name)
    (qualified id: (operator) @name)
  ]) @reference.call
