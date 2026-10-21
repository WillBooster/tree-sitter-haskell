module HscCommentBoundaries where
unicodeComment = #{if 1} 1 #{else} --⊕#{endif}
ignoredUnicode = 10
#{endif}
colonComment = #{if 1} 2 #{else} --:#{endif}
ignoredColon = 20
#{endif}
longComment = #{if 1} 3 #{else} ----⋆#{endif}
ignoredLong = 30
#{endif}
operator = #{if 1} 4 #{else} --+ #{endif}
following = 5
