module HscWhitespaceBoundaries where
textCR = #{if 1} 1 #{else} --comment#{endif}
ignoredtextCR = 11
#{endif}
textFF = #{if 1} 1 #{else} --comment#{endif}
ignoredtextFF = 11
#{endif}
argCR = #const 2+3
argFF = #const 4+5
commentFF = #{const 6 // ignored} +999
}
following = 7
