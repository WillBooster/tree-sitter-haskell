const { quoted_string } = require('./util.js')

const id_char = /[\pL\p{Mn}\pN_']*/

const varid_start_char = /[_\p{Ll}\p{Lo}]/

const conid_start_char = /[\p{Lu}\p{Lt}]/

module.exports = {

  variable: _ => token(seq(varid_start_char, id_char, /#*/)),

  implicit_variable: _ => token(seq('?', varid_start_char, id_char)),

  name: _ => token(seq(conid_start_char, id_char, /#*/)),

  label: _ => token(seq('#', choice(/[\pL\p{Mn}\pN_']+/, quoted_string(
    /[^\p{C}\p{Zl}\p{Zp}\\"]/,
    /\\(?:[abfnrtv\\"'&]|\^[@-_]|[0-9]+|o[0-7]+|x[0-9a-fA-F]+|NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC[1-4]|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL)/,
  )))),

  _carrow: _ => choice('=>', '⇒'),
  _arrow: _ => choice('->', '→'),
  _linear_arrow: _ => choice('->.', '⊸'),
  _larrow: _ => choice('<-', '←'),
  _colon2: _ => choice('::', '∷'),
  _promote: _ => '\'',

  _qual_dot: $ => seq($._cond_qual_dot, '.'),
  _tight_dot: $ => seq($._cond_tight_dot, '.'),
  _any_tight_dot: $ => choice($._qual_dot, $._tight_dot),
  _prefix_dot: $ => seq($._cond_prefix_dot, '.'),
  _any_prefix_dot: $ => choice($._qual_dot, $._prefix_dot),

  _tight_at: $ => seq($._cond_tight_at, '@'),
  _prefix_at: $ => seq($._cond_prefix_at, '@'),

  _prefix_bang: $ => seq($._cond_prefix_bang, '!'),
  _tight_bang: $ => seq($._cond_tight_bang, '!'),
  _any_prefix_bang: $ => choice($._prefix_bang, $._tight_bang),

  _prefix_tilde: $ => seq($._cond_prefix_tilde, '~'),
  _tight_tilde: $ => seq($._cond_tight_tilde, '~'),
  _any_prefix_tilde: $ => choice($._prefix_tilde, $._tight_tilde),

  _prefix_percent: $ => seq($._cond_prefix_percent, '%'),

  _dotdot: $ => seq($._cond_dotdot, '..'),

  _paren_open: $ => seq(alias(/\(/, '('), $._cmd_texp_start),
  _paren_close: $ => seq(alias(/\)/, ')'), $._cmd_texp_end),
  _bracket_open: $ => seq('[', $._cmd_texp_start),
  _bracket_close: $ => seq(']', $._cmd_texp_end),

  _unboxed_open: $ => alias(seq($._paren_open, choice(token.immediate('#'), alias($._unboxed_hash, '(#'))), '(#'),
  _unboxed_close: $ => seq('#)', $._cmd_texp_end),
  _unboxed_bar: _ => choice('|', token.immediate('|')),

  _where: $ => seq(optional($._phantom_where), 'where'),

  _bar: $ => seq(optional($._phantom_bar), '|'),

}
