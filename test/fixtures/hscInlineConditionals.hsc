module HscInlineConditionals where
value = #{if 1} 1 #{else} 2 #{endif}
nested = #{if 1} 3 #{else} #{if 0} 4 #{else} 5 #{endif} #{endif}
quoted = #{if 1} 7 #{elif 0} "#{endif}" {- outer {- #{endif} -} -} '}' #{else} 8 #{endif}
line = #{if 1} 8
#{else}
ignored' = "#{endif}"
operatorText = +#{endif}
-- #{endif}
#{if 0} 10 #{endif}
#{endif}
following = 9
