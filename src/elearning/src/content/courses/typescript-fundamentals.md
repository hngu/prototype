---
title: TypeScript Fundamentals
description: What the compiler is really doing when it reads your code — inference, narrowing and the handful of types you will use every day, explained from the ground up.
level: beginner
tags: ['typescript', 'javascript', 'types']
icon: TS
accent: oklch(62% 0.185 255)
order: 1
draft: false
---

TypeScript is usually taught as a list of syntax: annotations, interfaces, generics. That
ordering makes the language feel like a pile of rules to memorise.

This course takes the opposite route. It starts with what the compiler actually is — a program
that reads your program before it runs, and then gets out of the way entirely — and then with the
thing it does constantly and mostly invisibly: **inference**. Once you can predict what type
TypeScript will pick on its own, most of the syntax turns out to be a way of correcting or
constraining a guess it already made.

From there it builds outward: the dozen or so types you will use every day, how the compiler
follows your own `if` statements to work out what a value is, how to teach it a check it does not
know, and why it compares types by shape rather than by name. It closes on the three ways to say
"I don't know" and on the difference between an empty box and no box at all.

Every lesson ends with a coding exercise that has a reference solution and unit tests you can run
yourself.
