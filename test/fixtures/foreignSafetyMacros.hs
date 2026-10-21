{-# LANGUAGE CPP, ForeignFunctionInterface, InterruptibleFFI #-}
#define CALLCONV ccall
#define CALL64 ccall
#define SAFE_ON_WIN safe
#define SAFE64 interruptible
#define CALL64suffix ccall
#define SAFE64suffix safe
module ForeignSafety where
import Foreign.C.Types
foreign import CALLCONV SAFE_ON_WIN "sin" c_sin :: CDouble -> IO CDouble
foreign import CALL64 SAFE64 "cos" c_cos :: CDouble -> IO CDouble
foreign import ccall SAFE64 c_tan :: CDouble -> IO CDouble
foreign import CALL64 "atan" c_atan :: CDouble -> IO CDouble
foreign import CALL64suffix SAFE64suffix "sin" c_mixed :: CDouble -> IO CDouble
foreign import ccall _foreignName :: CDouble -> IO CDouble
#define _CALL ccall
#define _SAFE unsafe
foreign import _CALL _SAFE "sin" c_underscore :: CDouble -> IO CDouble
foreign import ccall _SAFE :: CDouble -> IO CDouble
foreign export _CALL "hs_echo" hs_echo :: CDouble -> IO CDouble
hs_echo = pure
#define _ safe
foreign import ccall _ "sin" c_singleSafety :: CDouble -> IO CDouble
#undef _
#define _ ccall
foreign import _ safe "sin" c_singleCall :: CDouble -> IO CDouble
#undef _
following = 1
