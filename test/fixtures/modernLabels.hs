{-# LANGUAGE DataKinds, FlexibleInstances, MultiParamTypeClasses, ScopedTypeVariables, TypeApplications, OverloadedLabels, MagicHash, UnboxedTuples #-}
module ModernLabels where
import Data.Proxy (Proxy(..))
import GHC.Exts (Addr#)
import GHC.OverloadedLabels (IsLabel(..))
import GHC.TypeLits (KnownSymbol, symbolVal)
instance KnownSymbol symbol => IsLabel symbol String where
  fromLabel = symbolVal (Proxy @symbol)
labels :: [String]
labels = [ #foo, #Foo, #3, #17a23b, #2_3, #do, #type, #f'a', #'a', #', #''notTHSplice, #привет, #こんにちは, #"", #"Hello, World!", #"\"", #"continued\
  \line", #"3.14", #"..." ]
adjacent :: String
adjacent = (++) #hello#world
quotedAdjacent :: String
quotedAdjacent = (++) #"hello"#"world"
address :: Addr# -> Int -> Int
address _ value = value
magic :: Int
magic = address "hello"#2
hashVariable x# = x#
unboxed () = (# 1 :: Int, 2 :: Int #)
selected = #Foo :: String
following = 1 :: Int
