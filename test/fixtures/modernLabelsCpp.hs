{-# LANGUAGE CPP, DataKinds, FlexibleInstances, MultiParamTypeClasses, ScopedTypeVariables, TypeApplications, OverloadedLabels #-}
module ModernLabelsCpp where
import Data.Proxy (Proxy(..))
import GHC.OverloadedLabels (IsLabel(..))
import GHC.TypeLits (KnownSymbol, symbolVal)
instance KnownSymbol symbol => IsLabel symbol String where
  fromLabel = symbolVal (Proxy @symbol)
#if defined(FLAG)
selected = #Foo :: String
#else
selected = #"fallback" :: String
#endif
following = 1 :: Int
