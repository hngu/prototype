---
title: Classes and Object-Oriented TypeScript
description: Classes, visibility, inheritance and the patterns built on them — including the two features that reveal how TypeScript actually gets removed from your code.
level: intermediate
tags: ['typescript', 'classes', 'oop']
icon: Cls
accent: oklch(66% 0.15 150)
order: 4
draft: true
---

TypeScript's classes are JavaScript's classes with a checklist stapled on: the same
runtime behaviour, plus a compiler that knows what every instance is supposed to have
before you run anything.

This course covers the parts that carry their weight — declaring members, hiding
them, inheriting them, and making a class generic — and then two patterns people
reach for and often get wrong: decorators and mixins.

It is also where a seam in the language becomes visible. Most TypeScript is a sticker
you can peel off a file, leaving working JavaScript behind. A few features are not:
they need the compiler to *generate* code, which is why Node can run some TypeScript
directly and refuses other TypeScript outright. Two lessons here run straight into
that, and say so on the page rather than pretending otherwise.
