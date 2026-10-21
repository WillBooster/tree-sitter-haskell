(signature name: (variable)) @local.definition
(function name: (variable)) @local.definition
[(pattern/variable) (binding_pattern/variable)] @local.definition
(expression/variable) @local.reference
(expression/parenthesized_name (variable) @local.reference)
(_ name: (parenthesized_name (variable) @local.definition))
