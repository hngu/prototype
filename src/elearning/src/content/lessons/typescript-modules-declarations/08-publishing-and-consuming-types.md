---
title: Getting your labels into someone else's museum
course: typescript-modules-declarations
order: 8
summary: "Shipping types is a packaging problem rather than a typing one, and most broken published types come from four or five specific mistakes. You will be able to publish a package whose types resolve for every consumer, diagnose one that does not, and decide between bundling types and using DefinitelyTyped."
duration: 11
exercise: false
draft: false
---

You have written the labels. Now they have to survive being boxed up, posted, and unpacked by somebody
whose museum is arranged differently from yours.

Almost nothing about that is a typing problem. It is a packaging problem, and it is where a great many
otherwise good libraries fall over.

## Shipping types with your own package

Two arrangements, and the second is the one to use.

**The old way** was a top-level `types` field:

```jsonc
{ "main": "./dist/index.js", "types": "./dist/index.d.ts" }
```

Still worth including — older resolvers and some bundlers look for nothing else. But it cannot describe
subpaths or conditions, so on its own it is not enough.

**The modern way** is the `exports` map, and the rule from lesson 2 governs it:

```jsonc
{
  "name": "acme",
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./utils": {
      "types": "./dist/utils.d.ts",
      "import": "./dist/utils.js"
    }
  },
  "files": ["dist"]
}
```

**`types` must come first in each condition object.** Conditions match in order and the first hit wins,
so a `types` key after `import` is never reached and every consumer gets `any` — with all the paths
correct and nothing warning you.

The other line that quietly breaks things is `files`. If it does not include the directory holding your
`.d.ts` files, they are simply not in the published tarball, and everything works perfectly on your
machine forever. `npm pack --dry-run` lists what would actually ship, and it takes five seconds.

Generate the declarations rather than writing them: `"declaration": true` in `tsconfig.json`, plus
`"declarationMap": true` so a consumer's *go to definition* lands in your source instead of a `.d.ts`.

```quiz
id: typescript-modules-declarations-publishing-and-consuming-types-q1
q: A package publishes correct `.d.ts` files and its `exports` map lists `"import"` before `"types"`. What do consumers get?
- [x] `any` — conditions match in order, so `types` is never reached
- [ ] The correct types, since key order in JSON is not significant
- [ ] A resolution error naming the package
- [ ] Correct types under `moduleResolution: "bundler"` but not `"nodenext"`
explain: Export conditions are matched in declared order and the first match wins, so an earlier `import` condition ends the search before `types` is considered. Nothing errors, because there is a perfectly good JavaScript entry point — the package just appears untyped. JSON key order is insignificant *to JSON*, and significant to this algorithm, which is what makes it such a reliable trap.
```

## The dual-format problem

If you ship both ESM and CommonJS builds, you need **two** sets of declarations — and this is the part
everyone gets wrong, because the failure is invisible from the inside.

A `.d.ts` is interpreted according to where it sits, not according to who imported it. So one declaration
file cannot describe both builds: in an ESM context `export default` means one thing, and in a CommonJS
context the same file is read as if it were `export =`. The fix is `.d.mts` beside `.mjs` and `.d.cts`
beside `.cjs`, each with the matching syntax:

```jsonc
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

You cannot check this by eye and you should not try. **[arethetypeswrong.net](https://arethetypeswrong.net)**
exists precisely for it, and `attw --pack` runs the same checks in CI. It catches the masked-`types`
condition above too. Any package advertising dual format should run it before publishing; most of the
famously broken ones did not.

The simplifying option worth considering: **ship ESM only.** Node has supported `require()` of
ESM without top-level `await` since Node 22, so the reason for dual publishing is weaker every year, and
one format means one set of declarations and none of this.

```quiz
id: typescript-modules-declarations-publishing-and-consuming-types-q2
q: Why does a dual-format package need both `.d.mts` and `.d.cts` rather than one shared `.d.ts`?
- [x] A declaration file is interpreted as ESM or CommonJS by its own extension and location, not by the importer
- [ ] Because `.d.ts` files cannot be referenced from an `exports` map
- [ ] Because CommonJS consumers cannot read `interface` declarations
- [ ] To let the two builds have deliberately different APIs
explain: The module system a declaration file is read under is decided by its extension and surrounding `package.json`, so a single file cannot correctly describe both — `export default` and `export =` mean genuinely different things and the same text is read as one or the other. The two files normally describe the same API; the point is to describe it twice, in the right dialect each time.
```

## Consuming, and contributing types you do not own

From the other side, a package's types arrive one of three ways. **Bundled** — it ships its own `.d.ts`
and there is nothing to do. **`@types/<name>`** from DefinitelyTyped, installed separately, which is how
older or JavaScript-only packages get typed. **Neither**, which is `TS7016` and your problem.

For that last case the options in order of preference: check again that `@types` really does not exist
(a scoped package `@scope/name` becomes `@types/scope__name`, which people miss); write a minimal local
`.d.ts` covering only what you use, in a `types/` directory included by your tsconfig; or, as a last
resort, `declare module 'thing'` with no body — which types the whole package as `any` and should carry a
comment saying why.

Contributing to DefinitelyTyped is worth doing and worth understanding as a commitment: you are agreeing
to track someone else's releases. The mechanics are a PR to the repository with tests in a
`<name>-tests.ts` file, and version numbers in `@types` track the library's major and minor, not its
patch.

A note on `skipLibCheck`, which is on in most projects including this one: it stops the compiler
type-checking inside `.d.ts` files. It is a real speed win and it means **a published declaration file
with a genuine error in it may cause no complaint in a consumer's build**. Worth knowing when you are
publishing, because your consumers are not going to find your mistakes for you.

```quiz
id: typescript-modules-declarations-publishing-and-consuming-types-q3
q: You install `@scope/widget`, it has no bundled types, and `@types/scope/widget` does not exist. What should you check next?
- [x] `@types/scope__widget` — scoped packages use a double underscore on DefinitelyTyped
- [ ] `@types/@scope/widget`, which is the scoped naming convention
- [ ] Nothing — scoped packages cannot have DefinitelyTyped entries
- [ ] `@scope/types-widget`, published by the scope owner
explain: npm scopes cannot nest, so DefinitelyTyped flattens `@scope/widget` to `@types/scope__widget` with a double underscore. It is a small piece of trivia that regularly costs people an afternoon of writing declarations that already existed, which is why it is worth knowing rather than looking up.
```

## What to take away

- Put `types` first in every `exports` condition, keep the legacy top-level `types` field too, and check
  `files` actually includes your declarations — `npm pack --dry-run` settles it.
- A dual-format package needs `.d.mts` and `.d.cts`, because a declaration file's dialect comes from its
  own extension rather than from the importer.
- Do not verify published types by eye: `arethetypeswrong.net` or `attw --pack` in CI, and consider
  shipping ESM only to sidestep the whole problem.
- `@types/scope__name` is where scoped packages live, and `skipLibCheck` means your consumers may never
  report the error in your declaration file.
