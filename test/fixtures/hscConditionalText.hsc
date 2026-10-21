module HscConditionalText where
colon = #{if 1} 1 #{else} :#{endif}
unicode = #{if 1} 2 #{else} ⋆#{endif}
following = 3
