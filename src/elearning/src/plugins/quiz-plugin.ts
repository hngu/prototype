import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineMdastPlugin } from 'satteri'
import type { MdastPluginDefinition } from 'satteri'
import { parseQuizBlock } from './quiz-parse.ts'
import { expectedIdPrefix, quizIdProblem } from './quiz-id.ts'
import { renderQuiz } from './quiz-render.ts'

/**
 * Turns ```quiz fenced blocks into static, interactive-ready HTML.
 *
 * Why an mdast plugin and not a remark plugin: Astro 7 ships Sätteri as the
 * default Markdown processor and `@astrojs/markdown-remark` is only an optional
 * peer dependency, so `markdown.remarkPlugins` entries are silently ignored.
 *
 * Why we replace at the *mdast* phase: Shiki's highlighter runs later, on hast
 * `<pre>` elements. Because the code node is gone before then, the quiz block
 * never reaches the highlighter and no `excludeLangs` config is needed.
 *
 * Why we throw instead of `ctx.report()`: `@astrojs/markdown-satteri` destructures
 * only `{ html, data }` from `markdownToHtml`, so Sätteri diagnostics are
 * discarded and a reported "error" would be silently swallowed.
 *
 * !! A THROW HERE DOES NOT FAIL THE BUILD. !!
 *
 * Measured, not assumed. Astro 7's glob loader catches whatever `render()`
 * throws, logs `[ERROR] [glob-loader] Error rendering <file>`, and carries on —
 * `astro build` then exits **0** having emitted the lesson page with a
 * completely empty `<article>`. Silently publishing an empty lesson is the worst
 * failure mode available, so the real gate lives outside this pipeline in
 * `scripts/check-content.ts`, which validates every quiz block before the build
 * runs and cannot be swallowed by anything.
 *
 * The throw is kept anyway, for two reasons: in `astro dev` it surfaces in the
 * error overlay next to the content you are editing, and the log line names the
 * offending file when a build does go wrong. It is a developer convenience, not
 * a guarantee. `scripts/check-build.ts` is the belt to this braces — it asserts
 * the emitted pages are not empty, which catches this class of failure even when
 * the cause is something nobody has thought of yet.
 *
 * One more trap worth knowing: rendered Markdown is cached in
 * `node_modules/.astro`, which survives `rm -rf .astro`. A change to *this* file
 * therefore does not re-validate existing lessons on a normal rebuild. The
 * `check:content` script reads the `.md` files directly and is immune.
 */

/** Quiz id → path of the file that claimed it. Module scope, so it spans the
 *  whole build and catches duplicate ids across different lesson files. */
const seenIds = new Map<string, string>()

/** path → raw file contents, so a file with several quizzes is read once. */
const sourceCache = new Map<string, string | null>()

function readSource(path: string): string | null {
  if (!sourceCache.has(path)) {
    try {
      sourceCache.set(path, readFileSync(path, 'utf8'))
    } catch {
      sourceCache.set(path, null)
    }
  }
  return sourceCache.get(path) ?? null
}

/**
 * Line number (1-based, in the real file) of the first line inside the fence.
 *
 * `node.position` counts from the start of the *post-frontmatter* body, so
 * using it directly reports every error several lines too early — the exact
 * height of the frontmatter block. Rather than reverse-engineer how much the
 * frontmatter consumed, locate the block body in the raw file and read the real
 * line number off that. Exact, and immune to changes in frontmatter handling.
 *
 * Falls back to the position-derived value if the file can't be read or the
 * body can't be located (an editor mid-save, say) — a slightly wrong line beats
 * no error at all.
 */
function bodyStartLine(path: string, body: string, fencePosLine: number): number {
  const source = readSource(path)
  if (source) {
    const index = source.indexOf(body)
    if (index !== -1) {
      let line = 1
      for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10 /* \n */) line++
      return line
    }
  }
  return fencePosLine + 1
}

export function quizPlugin(): MdastPluginDefinition {
  return defineMdastPlugin({
    name: 'elearning-quiz',

    code(node, ctx) {
      if (node.lang !== 'quiz') return

      const file = ctx.fileURL ? fileURLToPath(ctx.fileURL) : '<unknown file>'

      const start = bodyStartLine(file, node.value, node.position?.start.line ?? 1)
      const at = (offset: number) => `${file}:${start + offset}`

      const result = parseQuizBlock(node.value)

      if (!result.ok) {
        const detail = result.issues.map((i) => `  ${at(i.lineOffset)}  ${i.message}`).join('\n')
        throw new Error(`Invalid \`\`\`quiz block:\n${detail}`)
      }

      const { block } = result

      // Shared with scripts/check-content.ts so the overlay and the gate can
      // never disagree about what a valid id is.
      const prefix = expectedIdPrefix(file)
      if (prefix !== null) {
        const problem = quizIdProblem(block.id, prefix)
        if (problem) throw new Error(`${at(0)}\n${problem}`)
      }

      // Key on the owning path rather than mere presence: the dev server
      // re-renders the same file on every edit, and that must stay idempotent
      // while a genuine cross-file collision still fails.
      const owner = seenIds.get(block.id)
      if (owner && owner !== file) {
        throw new Error(
          `Duplicate quiz id "${block.id}" at ${at(0)} — already used in ${owner}. ` +
            `Quiz ids must be unique across the whole site.`,
        )
      }
      seenIds.set(block.id, file)

      // Returning the replacement is equivalent to ctx.replaceNode(node, …).
      return { rawHtml: renderQuiz(block) }
    },
  })
}
