module HscCharacterBoundaries where
newline = #{if 0} id "" #{else} const '\n'"x" #{endif}
quote = #{if 0} id "" #{else} const '\''"x" #{endif}
slash = #{if 0} id "" #{else} const '\\'"x" #{endif}
named = #{if 0} id "" #{else} const '\NUL'"x" #{endif}
control = #{if 0} id "" #{else} const '\^A'"x" #{endif}
following = 1
