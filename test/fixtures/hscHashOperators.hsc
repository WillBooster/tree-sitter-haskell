{-# LANGUAGE MagicHash #-}
module HashOps where
(##+) :: Int -> Int -> Int
(##+) = (+)
(##|+) :: Int -> Int -> Int
(##|+) = (+)
(####+) :: Int -> Int -> Int
(####+) = (+)
(+##) :: Int -> Int -> Int
(+##) = (+)
value = 1 ##+ 2
barValue = 1 ##|+ 2
doubleValue = 1 ####+ 2
tailValue = 1 +## 2
following = 1
