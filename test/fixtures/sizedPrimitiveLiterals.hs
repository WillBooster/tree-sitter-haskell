{-# LANGUAGE ExtendedLiterals, MagicHash, NumericUnderscores #-}
module TypedPrimitiveFixture where
import GHC.Exts
vInt0 :: () -> Int#
vInt0 () = 55#Int
vInt1 :: () -> Int#
vInt1 () = 0b11_0111#Int
vInt2 :: () -> Int#
vInt2 () = 0o67#Int
vInt3 :: () -> Int#
vInt3 () = 0x37#Int
vInt80 :: () -> Int8#
vInt80 () = 55#Int8
vInt81 :: () -> Int8#
vInt81 () = 0b11_0111#Int8
vInt82 :: () -> Int8#
vInt82 () = 0o67#Int8
vInt83 :: () -> Int8#
vInt83 () = 0x37#Int8
vInt160 :: () -> Int16#
vInt160 () = 55#Int16
vInt161 :: () -> Int16#
vInt161 () = 0b11_0111#Int16
vInt162 :: () -> Int16#
vInt162 () = 0o67#Int16
vInt163 :: () -> Int16#
vInt163 () = 0x37#Int16
vInt320 :: () -> Int32#
vInt320 () = 55#Int32
vInt321 :: () -> Int32#
vInt321 () = 0b11_0111#Int32
vInt322 :: () -> Int32#
vInt322 () = 0o67#Int32
vInt323 :: () -> Int32#
vInt323 () = 0x37#Int32
vInt640 :: () -> Int64#
vInt640 () = 55#Int64
vInt641 :: () -> Int64#
vInt641 () = 0b11_0111#Int64
vInt642 :: () -> Int64#
vInt642 () = 0o67#Int64
vInt643 :: () -> Int64#
vInt643 () = 0x37#Int64
vWord0 :: () -> Word#
vWord0 () = 55#Word
vWord1 :: () -> Word#
vWord1 () = 0b11_0111#Word
vWord2 :: () -> Word#
vWord2 () = 0o67#Word
vWord3 :: () -> Word#
vWord3 () = 0x37#Word
vWord80 :: () -> Word8#
vWord80 () = 55#Word8
vWord81 :: () -> Word8#
vWord81 () = 0b11_0111#Word8
vWord82 :: () -> Word8#
vWord82 () = 0o67#Word8
vWord83 :: () -> Word8#
vWord83 () = 0x37#Word8
vWord160 :: () -> Word16#
vWord160 () = 55#Word16
vWord161 :: () -> Word16#
vWord161 () = 0b11_0111#Word16
vWord162 :: () -> Word16#
vWord162 () = 0o67#Word16
vWord163 :: () -> Word16#
vWord163 () = 0x37#Word16
vWord320 :: () -> Word32#
vWord320 () = 55#Word32
vWord321 :: () -> Word32#
vWord321 () = 0b11_0111#Word32
vWord322 :: () -> Word32#
vWord322 () = 0o67#Word32
vWord323 :: () -> Word32#
vWord323 () = 0x37#Word32
vWord640 :: () -> Word64#
vWord640 () = 55#Word64
vWord641 :: () -> Word64#
vWord641 () = 0b11_0111#Word64
vWord642 :: () -> Word64#
vWord642 () = 0o67#Word64
vWord643 :: () -> Word64#
vWord643 () = 0x37#Word64
negativeInt8 :: () -> Int8#
negativeInt8 () = -55#Int8
negativeWord8 :: () -> Word8#
negativeWord8 () = -55#Word8
underscoredOctal :: () -> Int16#
underscoredOctal () = 0o_6_7#Int16
underscoredHex :: () -> Word32#
underscoredHex () = 0x_3_7#Word32
following = 1
