{-# LANGUAGE DisambiguateRecordFields, NamedFieldPuns, NoFieldSelectors, ScopedTypeVariables, TemplateHaskell, ViewPatterns #-}
module DestructuredBindings where

data Packet = Packet { punned :: Int, payload :: Maybe Int }

(first, second) = (1 :: Int, 2 :: Int)
Just extracted = Just (3 :: Int)
(headValue:tailValues) = [4 :: Int, 5]
whole@(nestedFirst, (nestedSecond, nestedThird)) = (6 :: Int, (7 :: Int, 8 :: Int))
Packet { punned, payload = Just fieldValue } = Packet 9 (Just 10)
(id -> Just viewed) = Just (11 :: Int)
((typed :: Int), typeCompanion) = (12, 13 :: Int)
~(lazyFirst, lazySecond) = (14 :: Int, 15 :: Int)

keep parameter@(argumentLeft, argumentRight) =
  let (localLeft, localRight) = parameter
      Packet { punned, payload = Just localPayload } = Packet 1 (Just 2)
  in localLeft + localRight + punned + localPayload + argumentLeft + argumentRight

withWhere parameter = whereLeft + parameter
  where (whereLeft, whereRight) = (1 :: Int, 2 :: Int)

withDo :: Maybe Int
withDo = do
  (doLeft, doRight) <- pure (1 :: Int, 2 :: Int)
  pure (doLeft + doRight)

withComprehension = [compLeft | (compLeft, compRight) <- [(1 :: Int, 2 :: Int)]]
[listFirst, listSecond] = [16 :: Int, 17]
keepRecord Packet { punned } = punned

quotedDefinitions () = [d|
  quotedSimple = 1
  quotedFunction (Just quotedParameter) = quotedParameter
  (quotedFirst, quotedSecond) = (1, 2)
  Just quotedExtracted = Just 42
  quotedWhole@(quotedLeft, quotedRight) = (1, 2)
  Packet { punned, payload = Just quotedField } = Packet 1 (Just 2)
  data QuotedType = QuotedConstructor Int
  type QuotedAlias = Int
  |]
