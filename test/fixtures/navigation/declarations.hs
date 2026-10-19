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
