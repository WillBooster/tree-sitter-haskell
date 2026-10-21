{-# LANGUAGE DataKinds, NoStarIsType, TypeOperators #-}
module Fixity156 where

import Prelude

infixr 8 .^.
(.^.) :: Integer -> Integer -> Integer
x .^. y = x ^ y

infixl 4 .+.
(.+.) :: Integer -> Integer -> Integer
x .+. y = x + y

original = 6 * 7 == 42
highNegation = -2 .^. 2
lowNegation = -2 .+. 2
application f x y z = f x .+. y .^. z
parenthesized = (1 .+. 2) .^. 3
leftSection = (1 .^. 2 .+.)
rightSection = (.+. 1 .^. 2)
backticks x y z = x `div` y `mod` z
qualified = 1 Prelude.+ 2 Prelude.* 3

infixr 6 :+:
infixl 7 :*:
data Tree = Leaf Integer | Tree :+: Tree | Tree :*: Tree
patternChain (a :+: b :*: c) = (a, b, c)
Leaf first :+: Leaf second :*: Leaf third = Leaf 1 :+: Leaf 2 :*: Leaf 3

type a :*: b = (a, b)
type a :+: b = Either a b
type TypeChain = Integer :+: Bool :*: Char
following = 1
