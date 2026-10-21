{-# LANGUAGE DataKinds, ExtendedLiterals, FlexibleInstances, KindSignatures, MagicHash, MultiParamTypeClasses, OverloadedLabels, UnboxedTuples #-}
module HscDirectives where

import Data.Proxy (Proxy(..))
import Data.Word
import Foreign.C.Types (CDouble(..))
import GHC.Exts (Int64##)
import GHC.OverloadedLabels (IsLabel(..))

#include <stddef.h>
#include <stdint.h>
#{define HSC_VALUE 42}
#def struct HscPair {
  int first;
  long second;
};
#let defineSuffix = "1"
#let d ignored = "1"
#let make_name ignored = "HscValue"
#let make_constructor ignored = "HscValue"
#le\
t emit2 ignored = "2"
#let call = "ccall"
#let safety = "safe"
#let entity = "\"sin\""

data #{make_name ignored} = #{make_constructor ignored} #{type size_t}

sizeValue :: Int
sizeValue = #{size struct HscPair}
offsetValue = (#offset struct HscPair, second)
constantValue =
  #const (HSC_VALUE + (sizeof("}") - sizeof("}")))
continuedValue = #const HSC_VALUE + \
  1
customValue = #{emit2 ignored}
spacedValue = # 	 {
  const HSC_VALUE}
splicedNameValue = #co\
nst HSC_VALUE
quotedValue = #{const_str "a brace } and quote \" and /* comment */"}
charValue = #{const (int)'}'}
commentValue = #{const (HSC_VALUE /* } \" ' */ + 0)}
splicedCommentValue = #{const (HSC_VALUE /\
* } \" ' *\
/ + 0)}

inlineMetaValue = (#{let emit_inline = "1"} #{emit_inline})
prefixNameValue = #{defineSuffix}
shortNameValue = #{d e f}

foreign import #{call} #{safety} #{entity} c_sin :: CDouble -> IO CDouble

primitiveValue :: () -> Int64##
primitiveValue () = 55##Int64
unboxedValue () = (## 1, 2 ##)

instance IsLabel name (Proxy name) where
  fromLabel = Proxy

labelValue :: (Proxy "", Proxy "nested label")
labelValue = ( ##"", ( ##"nested label" ))

keywordLabels :: (Proxy "include", Proxy "define", Proxy "let")
keywordLabels = ( ##include, ##define, ##let)

following = 1
