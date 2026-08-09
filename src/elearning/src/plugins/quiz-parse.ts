/**
 * Parser + validator for ```quiz fenced blocks.
 *
 * Deliberately dependency-free and free of any Sätteri/Astro imports, so it can
 * be exercised standalone (`node --experimental-strip-types`) without spinning
 * up a build. This is the most bug-prone piece of the pipeline; keeping it pure
 * is what makes it cheap to test.
 *
 * Syntax:
 *
 *   id: type-inference-1
 *   q: What type is inferred for `const x = 5`?
 *   - [x] `5`
 *   - [ ] `number`
 *   - [ ] `any`
 *   explain: A `const` declaration narrows to the literal type.
 *
 * Not YAML: YAML strips `#` comments and has no clean way to express the `[x]`
 * marker. Checkbox syntax is unambiguous, makes multi-select fall out of marking
 * two boxes, and still renders as a task list on GitHub.
 */

export type QuizMode = 'single' | 'multi' | 'true-false'

export interface QuizChoice {
  text: string
  correct: boolean
}

export interface QuizBlock {
  id: string
  mode: QuizMode
  question: string
  choices: QuizChoice[]
  explain?: string
}

export interface ParseIssue {
  message: string
  /** 0-based index of the offending line *within the fence body*. */
  lineOffset: number
}

export type ParseResult = { ok: true; block: QuizBlock } | { ok: false; issues: ParseIssue[] }

const CHOICE_RE = /^\s*[-*]\s*\[([ xX])\]\s+(.+)$/
const KEY_RE = /^([a-zA-Z][\w-]*)\s*:\s*(.*)$/
const ID_RE = /^[a-z0-9][a-z0-9-]*$/

/** Canonical key → the aliases that map onto it. */
const KEY_ALIASES: Record<string, string> = {
  id: 'id',
  q: 'q',
  question: 'q',
  type: 'type',
  explain: 'explain',
  explanation: 'explain',
  answer: 'answer',
}

const TYPE_ALIASES: Record<string, QuizMode> = {
  single: 'single',
  'single-choice': 'single',
  'multiple-choice': 'single',
  multi: 'multi',
  multiple: 'multi',
  'multi-select': 'multi',
  'true-false': 'true-false',
  truefalse: 'true-false',
  tf: 'true-false',
  boolean: 'true-false',
}

const TRUTHY = new Set(['true', 't', 'yes', 'y'])
const FALSY = new Set(['false', 'f', 'no', 'n'])

export function parseQuizBlock(body: string): ParseResult {
  const issues: ParseIssue[] = []
  const fields = new Map<string, { value: string; lineOffset: number }>()
  const choices: QuizChoice[] = []
  const choiceLines: number[] = []

  let lastKey: string | null = null

  const lines = body.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue

    // Choice lines are checked first. They can never collide with a key, since
    // KEY_RE requires the line to start with a letter and a choice starts with
    // `-` or `*` — but ordering it this way keeps the intent obvious.
    const choiceMatch = CHOICE_RE.exec(line)
    if (choiceMatch) {
      choices.push({
        correct: choiceMatch[1]!.toLowerCase() === 'x',
        text: choiceMatch[2]!.trim(),
      })
      choiceLines.push(i)
      lastKey = null // a choice ends any preceding key's continuation
      continue
    }

    const keyMatch = KEY_RE.exec(line)
    if (keyMatch) {
      const rawKey = keyMatch[1]!.toLowerCase()
      const canonical = KEY_ALIASES[rawKey]

      if (!canonical) {
        // Silently ignoring `explaination:` is how content rots. Fail loudly.
        issues.push({
          message: `unknown field "${keyMatch[1]}" (expected one of: id, q, type, answer, explain)`,
          lineOffset: i,
        })
        lastKey = null
        continue
      }

      if (fields.has(canonical)) {
        issues.push({ message: `duplicate field "${canonical}"`, lineOffset: i })
        continue
      }

      fields.set(canonical, { value: keyMatch[2]!.trim(), lineOffset: i })
      lastKey = canonical
      continue
    }

    // Continuation: fold into the previous key, giving free multi-line q/explain.
    if (lastKey) {
      const prev = fields.get(lastKey)!
      prev.value = `${prev.value} ${line.trim()}`.trim()
      continue
    }

    issues.push({
      message: `unrecognized line (expected "key: value" or "- [ ] choice")`,
      lineOffset: i,
    })
  }

  const get = (k: string) => fields.get(k)?.value
  const lineOf = (k: string) => fields.get(k)?.lineOffset ?? 0

  // ── id ──────────────────────────────────────────────────────────────────
  const id = get('id')
  if (id === undefined || id === '') {
    issues.push({ message: 'missing required "id:" field', lineOffset: 0 })
  } else if (!ID_RE.test(id)) {
    issues.push({
      message: `id must be lowercase kebab-case (got "${id}")`,
      lineOffset: lineOf('id'),
    })
  }

  // ── question ────────────────────────────────────────────────────────────
  const question = get('q')
  if (question === undefined || question === '') {
    issues.push({ message: 'missing required "q:" field', lineOffset: 0 })
  }

  // ── mode ────────────────────────────────────────────────────────────────
  const rawType = get('type')
  let declaredMode: QuizMode | undefined
  if (rawType !== undefined && rawType !== '') {
    declaredMode = TYPE_ALIASES[rawType.toLowerCase()]
    if (!declaredMode) {
      issues.push({
        message: `unknown type "${rawType}" (expected single, multi, or true-false)`,
        lineOffset: lineOf('type'),
      })
    }
  }

  const correctCount = choices.filter((c) => c.correct).length
  const mode: QuizMode = declaredMode ?? (correctCount >= 2 ? 'multi' : 'single')

  // ── true/false ──────────────────────────────────────────────────────────
  const rawAnswer = get('answer')

  if (mode === 'true-false') {
    if (choices.length > 0) {
      issues.push({
        message: 'type: true-false takes an "answer:" field, not "- [ ]" choices',
        lineOffset: choiceLines[0] ?? 0,
      })
    }
    if (rawAnswer === undefined || rawAnswer === '') {
      issues.push({
        message: 'type: true-false requires "answer: true" or "answer: false"',
        lineOffset: 0,
      })
    } else {
      const a = rawAnswer.toLowerCase()
      if (!TRUTHY.has(a) && !FALSY.has(a)) {
        issues.push({
          message: `answer must be true or false (got "${rawAnswer}")`,
          lineOffset: lineOf('answer'),
        })
      }
    }
  } else {
    if (rawAnswer !== undefined) {
      issues.push({
        message: '"answer:" is only valid with type: true-false',
        lineOffset: lineOf('answer'),
      })
    }
    if (choices.length < 2) {
      issues.push({
        message: `needs at least 2 choices (got ${choices.length})`,
        lineOffset: 0,
      })
    }
    if (choices.length > 0 && correctCount === 0) {
      issues.push({
        message: 'no correct answer — mark one choice with "- [x]"',
        lineOffset: choiceLines[0] ?? 0,
      })
    }
    if (declaredMode === 'single' && correctCount > 1) {
      issues.push({
        message: `type: single but ${correctCount} choices are marked correct`,
        lineOffset: choiceLines[0] ?? 0,
      })
    }

    /* Case-SENSITIVE, deliberately. The check exists to catch an accidentally pasted
       duplicate, and those are byte-identical — so folding case buys nothing and costs
       real false positives on a site about a case-sensitive language. A quiz contrasting
       `Uppercase<'fontSize'>` with `Capitalize<'fontSize'>` needs options that differ
       only in case, and that is the question, not a mistake.

       Whitespace is still normalised, since trailing spaces are invisible and never
       meaningful. */
    const seen = new Map<string, number>()
    for (let i = 0; i < choices.length; i++) {
      const key = choices[i]!.text.trim().replace(/\s+/g, ' ')
      if (seen.has(key)) {
        issues.push({
          message: `duplicate choice text "${choices[i]!.text}"`,
          lineOffset: choiceLines[i] ?? 0,
        })
      } else {
        seen.set(key, i)
      }
    }
  }

  if (issues.length > 0) {
    // Report in file order so the author reads them top-to-bottom.
    issues.sort((a, b) => a.lineOffset - b.lineOffset)
    return { ok: false, issues }
  }

  const explain = get('explain')
  const finalChoices: QuizChoice[] =
    mode === 'true-false'
      ? (() => {
          const yes = TRUTHY.has(rawAnswer!.toLowerCase())
          return [
            { text: 'True', correct: yes },
            { text: 'False', correct: !yes },
          ]
        })()
      : choices

  return {
    ok: true,
    block: {
      id: id!,
      mode,
      question: question!,
      choices: finalChoices,
      ...(explain ? { explain } : {}),
    },
  }
}
