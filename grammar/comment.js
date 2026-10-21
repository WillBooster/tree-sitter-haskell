module.exports = {

  comment: $ => choice(
    seq('{-', $._cond_comment_block, $.content, '-}'),
    seq(alias(/--+/, '--'), $._cond_comment_line, $.content),
  ),

  haddock: $ => choice(
    seq('{-', $._cond_haddock_block, alias(choice('|', '^'), 'haddock_marker'), $.content, '-}'),
    seq(alias(/--+/, '--'), $._cond_haddock_line, alias(choice('|', '^'), 'haddock_marker'), $.content),
  ),

}
