---
title: Tooling and Config
description: tsc, tsconfig.json and the flags that change what TypeScript will accept. Which switches earn their keep, which are trivia, and who strips your types in production.
level: advanced
tags: ['typescript', 'tsconfig', 'tooling']
icon: cfg
accent: oklch(60% 0.13 30)
order: 6
draft: true
---

`tsconfig.json` has well over a hundred options. About twelve of them change how you
write code; the rest you will look up once and forget, correctly.

This course is a tour of the ones that matter, organised by what they buy you rather
than alphabetically. The centrepiece is strictness: `strict: true` is a single switch
that flips eight others, and knowing what each one catches is the difference between
turning it on and turning it back off again a week later.

There is also a lesson on the seam between checking and running. The compiler that
checks your types is usually not the tool that removes them — a bundler, Babel or Node
itself does that, and none of them check anything. Understanding that split explains a
whole category of "but it compiled" bugs, and it is why the exercises on this site are
authored the way they are.
