{-# LANGUAGE DeriveAnyClass, DerivingStrategies, FlexibleInstances, MultiParamTypeClasses, StandaloneDeriving, TypeOperators #-}
module Fixity156Instances where

infixr 5 :*:
infixr 6 :+:
class a :*: b
data a :+: b = Pair a b
instance Int :*: Bool
instance Int :+: Bool :*: Char
deriving anyclass instance Bool :*: Int
following = 1
