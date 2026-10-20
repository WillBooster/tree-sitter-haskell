module NavigationDepth where
(f x) y = x
((g x) y) z = x
(((((deep x))))) y = x
class C a where
  (method x) y = x
instance C Int where
  ((method x) y) z = x
data ((Box a) b) = MkBox a b
type ((Alias a) b) = Either a b
class ((Related a) b) where
instance ((Related Int) Bool)
calls value = (((f))) value
qualified value = (((Demo.f))) value
operators value = ((((<+>)))) value
qualifiedOperators value = ((((Demo.<+>)))) value
held = (((f)))
heldOperator = ((((<+>))))
outer ((argument)) = argument
((left <+> right)) extra = left
((left `combine` right)) extra = left
class InfixMethod a where
  ((left <~> right)) extra = left
instance InfixMethod Int where
  ((left `methodInfix` right)) extra = left
data ((a :+: b)) c = MkInfix a b c
newtype ((Wrap a)) = MkWrap a
type ((a :/: b)) c = Either a b
type family ((Family a)) b
data family ((DataFamily a)) b
class ((a :<: b)) c where
instance ((Int :<: Bool)) Char
deriving instance ((Related Int)) Bool
local value = result where
  ((hidden argument)) extra = argument
  (first, second) = (value, value)
patternArg (Just ((bound))) = bound
complex value = ((if value then f else g)) value
heldQualified = (((Demo.f)))
following = 1
instance ((Kinded :: a :+: b))
deriving instance ((Related :: a :*: b))
a1 = (f) @Int x
a2 = f @Int x
a3 = (f) x
a4 = ((f)) @Int x
a5 = ((Demo.f)) @Int x
a6 = (((<+>))) @Int x
a7 = (((Demo.<+>))) @Int x
a8 = (((f))) @Int
a9 = (((f))) (type Int)
