---
title: Modules and Declaration Files
description: How files find each other, how ESM and CommonJS coexist, and how to describe code you cannot change — the part of TypeScript people hit when they leave a tutorial.
level: advanced
tags: ['typescript', 'modules', 'declaration-files']
icon: mod
accent: oklch(65% 0.16 60)
order: 5
draft: false
---

This is the course about everything outside your own file.

It starts gently — a file is a room, `export` decides what leaves — and then works
through the parts that actually cause trouble in real projects: how the compiler hunts
for `./thing`, why the file extension is not optional on Node, and what genuinely
happens when an ESM file imports a CommonJS one.

The second half is about describing code you do not control. A `.d.ts` file is a
museum label: it tells the compiler what something is without touching it. Writing
one well is a distinct skill, it is how the entire typed npm ecosystem holds together,
and it is very poorly explained almost everywhere. There is also a lesson on
namespaces and triple-slash directives — not because you should write them, but
because you will inherit them.
