module.exports = {

  comment: $ => choice(
    seq('{-', $._cond_comment_block, $.content, '-}'),
    seq(alias(/--+/, '--'), $._cond_comment_line, $.content),
  ),

  haddock: $ => choice(
    seq('{-', $._cond_haddock_block, choice('|', '^'), $.content, '-}'),
    seq(alias(/--+/, '--'), $._cond_haddock_line, choice('|', '^'), $.content),
  ),

}
