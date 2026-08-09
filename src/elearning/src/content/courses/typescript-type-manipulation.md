---
title: Type Manipulation
description: Building types out of other types. Generics, keyof, conditional and mapped types — and why the standard utility types stop looking like magic once you have written them.
level: intermediate
tags: ['typescript', 'generics', 'types']
icon: T<>
accent: oklch(62% 0.19 300)
order: 3
draft: false
---

Up to here, types have been things you write down. This course is about types you
*compute* — a small, strange, surprisingly powerful language that runs entirely at
compile time and produces types instead of values.

It starts with generics, which are simply recipes that work for any ingredient and
remember which one you used. Everything after that is a way of asking a type a
question: what are your keys, what is at this key, what would you be if you were
wrapped in a Promise, what would you look like if every field were optional.

The last two lessons are the payoff. By then you will have hand-rolled `Partial` and
`Readonly` yourself, so the standard utility types arrive as a list of things you
already know how to build — which is a much better feeling than memorising them.
