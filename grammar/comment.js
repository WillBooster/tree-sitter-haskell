module.exports = {

  comment: $ => seq(
    $._cond_comment,
    choice(
      seq('{-', $.content, '-}'),
      seq(alias(/--+/, '--'), $.content),
    ),
  ),

  haddock: $ => seq(
    $._cond_haddock,
    choice(
      seq('{-', choice('|', '^'), $.content, '-}'),
      seq(alias(/--+/, '--'), choice('|', '^'), $.content),
    ),
  ),

}
