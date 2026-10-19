-- | Navigation module.
module Demo.Navigation where

-- | Convert a value.
convert :: a -> a
convert value = value

first, second :: Int
first = 1
second = first

-- | A type and its constructor.
data Box a = Box a
newtype Wrapped a = Wrapped a
type Alias = Int

-- | A method owner.
class Printable a where
  -- | Render a value.
  render :: a -> String
  render value = convert value

instance Printable Int where
  render value = show value

(<+>) left right = left
left `combine` right = convert left

use value = convert (convert value)
qualified value = Demo.convert value
operator left right = left <+> right

qualifiedPrefix left right = (Demo.<+>) left right
qualifiedBacktick left right = left `Demo.combine` right

data family Family a
class Associated a where
  data Assoc a
foreign import ccall "external" external :: Int -> Int

data a :+: b = Pair a b
newtype a :*: b = Product a
type a :/: b = (a, b)
type family a :?: b
data family a :!: b
class a :<: b where
  project :: a -> b
instance Int :<: Int where
  project value = value
class a `Related` b
instance Int `Related` Int

class Defaulted a where
  default single :: a -> a
  default pair, other :: a -> a
  single value = value
instance Defaulted Int where
  pair, other :: Int -> Int
  pair value = value
  other value = value
deriving instance Show (Box a)
deriving instance Int :<: Int
deriving instance Int `Related` Int

type InfixUse a b = a :+: b
type a :%: b = a :+: b
data instance Family Int = FamilyInt
newtype instance Family Bool = FamilyBool Bool
instance Associated Int where
  data Assoc Int = AssocInt
type instance Int :?: Bool = Int

parenthesized value = (convert) value
qualifiedParenthesized value = (Demo.convert) value
parenthesizedOperator left right = ((<+>)) left right
qualifiedParenthesizedOperator left right = ((Demo.<+>)) left right
unusedParenthesized = (convert)
unusedQualifiedParenthesized = (Demo.convert)

data KData :: a :+: b where
newtype KNewtype :: a :*: b where
type family KType a :: a :/: b
data family KFamily a :: a :!: b
data a :&: b :: a :/: b where
data Eq a => a :^: b :: a :/: b where
newtype Eq a => a :~: b :: a :/: b where
data (:$:) a b = PrefixPair a b
class (:=:) a b
instance (:=:) Int Int
instance Demo.Printable Int
deriving instance Demo.Printable Int
newtype (:%>) a b = PrefixWrap a
type (%%) a b = (a, b)
type family (>>>) a b
data family (:#:) a

type family {- comment -} a :?> b :: a :/: b
data family {- comment -} a :*> b :: a :/: b
data {- comment -} a :&> b :: a :/: b where
data {- before -} Eq a => {- after -} a :^> b :: a :/: b where
newtype {- before -} Eq a => {- after -} a :~> b :: a :/: b where
class Commented a where
  type {- comment -} a :+> b :: a :/: b
  data {- comment -} a :-> b :: a :/: b
type family {-| docs -} a :$> b :: a :/: b
data family {-# ANN module "navigation" #-} a :%> b :: a :/: b
type family
#if NAVIGATION
#endif
  a :!> b :: a :/: b
