---
title: How the compiler remembers
course: typescript-tooling-config
order: 6
summary: "`--watch` and `incremental` are two different kinds of memory, and knowing which one you are relying on explains most complaints about `tsc` being slow. You will be able to choose between them, configure file watching for a container, and recognise the stale-cache failures each one causes."
duration: 10
exercise: false
draft: false
---

Somebody who has read your whole manuscript can tell you what one changed paragraph broke. Somebody
starting fresh has to read all of it again to say the same thing.

`tsc` can work either way, and the difference is not subtle: a cold check of a large project reads every
`.d.ts` in `node_modules`, and a warm one reads almost nothing.

## Two kinds of memory

**`--watch` keeps memory in the process.** The program stays resident, holds the parsed and checked
program in RAM, watches the filesystem, and on a change re-checks only the affected files. Nothing is
written to disk. Close the terminal and the memory is gone.

**`incremental: true` keeps memory on disk.** Each run writes a `.tsbuildinfo` file holding file
fingerprints and a dependency graph, so the *next* separate run can skip what has not changed.

They solve different problems, and the distinction is the practical point of this lesson:

| | `--watch` | `incremental` |
| --- | --- | --- |
| Memory lives | in the process | in `.tsbuildinfo` |
| Helps | the session you are in | the next invocation |
| Good for | editing | CI, pre-commit hooks, local repeated runs |
| Cost | a resident process | a file to keep, and to invalidate correctly |

Both, together, is normal and sensible. And your editor is doing a third version of the same thing: the
TypeScript language server holds a resident program of its own, which is why the editor knows about an
error before your terminal does — and why "restart TS server" fixes things that look impossible.

```quiz
id: typescript-tooling-config-watch-and-incremental-q1
q: What is the difference between `--watch` and `incremental: true`?
- [x] `--watch` keeps the program in memory for this session; `incremental` writes state to disk for the next run
- [ ] They are the same feature; `--watch` implies `incremental`
- [ ] `incremental` only re-checks changed files, while `--watch` re-checks everything
- [ ] `--watch` is for development and `incremental` is for emitting declarations
explain: One is in-process memory that dies with the process, the other is a `.tsbuildinfo` file that survives it — so they help at different moments and are commonly used together. Both re-check only what is affected; the question is whether that knowledge outlives the command.
```

## Making watching work where it does not

File watching is an operating-system feature and it is unreliable in exactly two places: Docker
bind-mounts, and network filesystems. The symptom is that saving a file changes nothing, which reads as
`tsc` being broken rather than the events never arriving.

`watchOptions` is the fix:

```jsonc
{
  "watchOptions": {
    "watchFile": "useFsEvents",
    "watchDirectory": "useFsEvents",
    "fallbackPolling": "dynamicPriority",
    "excludeDirectories": ["**/node_modules", "dist"]
  }
}
```

`useFsEvents` uses native OS notifications — efficient, and what you want when they work. When they do
not, `"watchFile": "priorityPollingInterval"` polls instead: slower and CPU-hungry, and it *works*, which
in a container is the whole requirement.

`excludeDirectories` is the one worth setting even when everything is fine. Watching `node_modules` means
watching hundreds of thousands of files for changes that essentially never happen, and on macOS it is a
common cause of `tsc --watch` eating a core for no reason.

```quiz
id: typescript-tooling-config-watch-and-incremental-q2
q: `tsc --watch` does not react to file changes inside a Docker container with a bind-mounted source directory. What is the fix?
- [x] Switch to polling with `watchOptions.watchFile`, since native filesystem events do not cross the mount
- [ ] Increase the container's memory limit
- [ ] Add the source directory to `include`
- [ ] Run `tsc --watch --force`
explain: Native change notifications are not reliably delivered across bind-mounts or network filesystems, so no amount of configuring what to watch helps — the events simply are not arriving. Polling asks repeatedly instead, which costs CPU and works. This is the single most common "tsc --watch is broken" report and it is not a TypeScript bug.
```

## Where the caches lie to you

Both mechanisms fail the same way: they believe something is current when it is not. Worth being able to
recognise, because the errors are confusing rather than informative.

**A stale `.tsbuildinfo`** produces errors about types that look correct in the source in front of you, or
the absence of errors that should be there. It happens after a `git rebase` that changes file timestamps
oddly, or when a dependency changes without your inputs changing. Deleting the file is the fix, and
`--force` skips the up-to-date checks for one run.

**`.tsbuildinfo` belongs in `.gitignore`.** It contains absolute paths, so a committed one is wrong on
every other machine, and it can be large.

**Watch mode can miss a rename.** Some editors save by writing a temporary file and renaming it over the
original, which arrives as a delete followed by a create — and depending on the watcher, one of those can
be dropped. Restarting is the fix, and if it happens often, polling is the cure.

Two things that help more than tuning either of them. `skipLibCheck: true` stops the compiler checking
inside every `.d.ts` in `node_modules`, and on a large dependency tree it is often the single biggest win
available. And `tsc --diagnostics` (or `--extendedDiagnostics`) tells you where the time actually goes —
`Files` and `Check time` versus `Program time` distinguishes "too many files" from "types too complex",
which are different problems with different fixes.

If it is types-too-complex, the usual culprits are a deeply recursive conditional type, a very large union
being distributed over, or a template literal type multiplying out — course 3's material, arriving as a
performance problem.

```quiz
id: typescript-tooling-config-watch-and-incremental-q3
q: Should `.tsbuildinfo` be committed to version control?
- [x] No — it contains absolute paths, so it is wrong on any other machine
- [ ] Yes, so CI can skip work on the first run
- [ ] Yes, but only for `composite` projects
- [ ] It does not matter, since `tsc` regenerates it when invalid
explain: Absolute paths make a committed `.tsbuildinfo` inapplicable elsewhere, and it can be large enough to matter in a diff. CI caching of the file by path is a legitimate optimisation, but that is your CI provider's cache rather than your repository. It usually *is* regenerated when invalid, which is exactly why committing it buys nothing.
```

## What to take away

- `--watch` is memory in the process, `incremental` is memory on disk in `.tsbuildinfo` — different
  problems, commonly used together, and your editor runs a third copy of the same idea.
- File watching fails across Docker bind-mounts and network filesystems; polling via `watchOptions` is the
  cure, and `excludeDirectories` for `node_modules` is worth setting anyway.
- Stale caches produce errors that contradict the source you are reading. Delete `.tsbuildinfo`, keep it in
  `.gitignore`, and reach for `--force` when in doubt.
- Before tuning any of this, try `skipLibCheck` and `tsc --extendedDiagnostics` — "too many files" and
  "types too complex" need different fixes.
