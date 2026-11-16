const haskell = require('../grammar.js')
const expressions = require('../grammar/exp.js')
const modules = require('../grammar/module.js')

module.exports = grammar(haskell, {
  name: 'haskell_ghc2021',
  rules: {
    ...expressions(false),
    ...modules(false),
    _universal: $ => choice($.literal, $._unit_cons, $._tuple_cons),
  },
})
