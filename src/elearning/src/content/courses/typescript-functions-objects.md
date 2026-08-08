---
title: Functions and Objects
description: The two shapes almost all TypeScript is made of. How to describe what a function accepts and returns, and how to describe the objects moving between them.
level: beginner
tags: ['typescript', 'functions', 'objects']
icon: Fn
accent: oklch(64% 0.16 200)
order: 2
draft: true
---

Once you can predict what TypeScript infers, the next thing worth learning is how to
describe the two shapes almost every program is built from: the functions that do the
work, and the objects that travel between them.

This course is mostly about being precise where it pays. An optional parameter and a
parameter that accepts `undefined` are different promises. An array and a tuple are
different promises. A form that must have exactly these fields and a form that may
carry extra rows are different promises. Getting those right is what stops types
from being decoration.

It ends with two things people meet in real code long before anyone explains them:
generators, which hand you one value at a time and remember where they stopped, and
symbols, which are keys cut so precisely that nobody else's key fits.
