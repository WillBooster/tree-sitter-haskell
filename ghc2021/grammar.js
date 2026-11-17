const haskell = require('../grammar.js')
const expressions = require('../grammar/exp.js')
const modules = require('../grammar/module.js')
const data = require('../grammar/data.js')
const patterns = require('../grammar/pat.js')
const types = require('../grammar/type.js')

module.exports = grammar(haskell, {
  name: 'haskell_ghc2021',
  rules: {
    ...expressions(false),
    ...modules(false),
    ...data(false),
    ...patterns(false),
    ...types(false),
    _unit_cons: $ => $.unit,
    _tuple_cons: $ => $.prefix_tuple,
    _universal: $ => choice($.literal, $._unit_cons, $._tuple_cons),
  },
})
