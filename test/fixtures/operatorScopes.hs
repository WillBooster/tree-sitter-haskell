{-# LANGUAGE BlockArguments #-}
module Fixity156Scopes where

greedyLet = 1 + let x = 2 in x * 3 + 4
greedyIf = 1 + if True then 2 else 3 * 4
blockApply f x = f \y -> y + x * 2
lambdaRhs f x = f $ \y -> y + x * 2
prefixApply f x y = -f x * y
typed x = x * 2 == 4 :: Bool
following = 1
