---
title: TypeScript in Practice
description: Adding TypeScript to code that already exists. Checking JavaScript in place, JSDoc types, migrating a module at a time, and typing JSX and the DOM.
level: intermediate
tags: ['typescript', 'javascript', 'migration']
icon: use
accent: oklch(58% 0.14 330)
order: 7
draft: true
---

Most TypeScript is not written from scratch. It is added to a working JavaScript
project by someone who cannot stop shipping while they do it.

This course is about that situation. You can type-check a `.js` file without renaming
it. You can describe types in JSDoc comments and get most of the benefit before you
convert anything. And when you do convert, you do it one room at a time with the
lights still on — not in a single heroic rewrite that never lands.

It finishes with the two places types meet something outside your program: JSX, where
your markup becomes type-checked, and the DOM, where the browser hands you values that
might not be there and TypeScript is right to be suspicious.
