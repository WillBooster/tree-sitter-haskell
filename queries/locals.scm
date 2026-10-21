(signature name: (variable)) @local.definition
(function name: (variable)) @local.definition
[(pattern_operand/variable) (binding_pattern_operand/variable)] @local.definition
(expression_operand/variable) @local.reference
(expression_operand/parenthesized_name (variable) @local.reference)
(_ name: (parenthesized_name (variable) @local.definition))
