---
title: TypeScript Fundamentals
description: How TypeScript actually infers, narrows and widens types — the mental model that makes the rest of the language stop feeling arbitrary.
level: beginner
tags: ['typescript', 'javascript', 'types']
icon: TS
accent: oklch(62% 0.185 255)
order: 1
draft: false
---

TypeScript is usually taught as a list of syntax: annotations, interfaces, generics. That
ordering makes the language feel like a pile of rules to memorise.

This course takes the opposite route. It starts with the one thing the compiler is doing
constantly and mostly invisibly — **inference** — and builds outward from there. Once you can
predict what type TypeScript will pick on its own, most of the syntax turns out to be a way of
correcting or constraining a guess it already made.
