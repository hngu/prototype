import { marked } from 'marked'
import type { QuizBlock } from './quiz-parse.ts'

/**
 * Renders a QuizBlock to static HTML at build time.
 *
 * The markup is a fixed, ARIA-heavy structure — not content — which is why this
 * is a template string rather than a tree of mdast nodes with hName/hProperties
 * hacks. (mdast has no node that maps to <input> anyway.)
 *
 * Inline Markdown in the question / choices / explanation is rendered with
 * marked.parseInline: backticks, bold, em and links, with no block wrapping and
 * no <p> to strip afterwards.
 *
 * NOTE: parseInline does not escape raw HTML. That is fine while all lesson
 * content is authored in this repo — but if community contributions are ever
 * accepted, this needs sanitising first.
 */
const inline = (md: string): string => marked.parseInline(md, { async: false })

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const PROMPTS: Record<QuizBlock['mode'], string> = {
  single: 'Select one answer.',
  multi: 'Select all that apply.',
  'true-false': 'True or false?',
}

export function renderQuiz(block: QuizBlock): string {
  const { id, mode, question, choices, explain } = block
  const inputType = mode === 'multi' ? 'checkbox' : 'radio'
  const name = `quiz-${id}`

  const items = choices
    .map((choice, index) => {
      // data-correct is readable in view-source. That is a deliberate, documented
      // tradeoff: client-side checking cannot be cheat-proof without a server,
      // and this is practice, not a proctored exam.
      return `      <li class="quiz__item">
        <label class="quiz__choice">
          <input class="quiz__input" type="${inputType}" name="${escapeAttr(name)}" value="${index}"${
            choice.correct ? ' data-correct="true"' : ''
          }>
          <span class="quiz__marker" aria-hidden="true"></span>
          <span class="quiz__text">${inline(choice.text)}</span>
        </label>
      </li>`
    })
    .join('\n')

  const answerList = choices
    .filter((c) => c.correct)
    .map((c) => inline(c.text))
    .join(', ')

  const explainHtml = explain
    ? `\n  <div class="quiz__explain" data-quiz-explain hidden>${inline(explain)}</div>`
    : ''

  // The <output> is present and EMPTY at load, hidden with CSS (:empty) rather
  // than the `hidden` attribute — live regions inserted into the DOM after load
  // are announced unreliably by screen readers.
  return `<form class="quiz quiz--${mode}" data-quiz data-quiz-id="${escapeAttr(id)}" data-quiz-mode="${mode}" novalidate>
  <fieldset class="quiz__fieldset">
    <legend class="quiz__question">${inline(question)}</legend>
    <p class="quiz__prompt">${PROMPTS[mode]}</p>
    <ul class="quiz__choices" role="list">
${items}
    </ul>
  </fieldset>
  <div class="quiz__actions">
    <button type="submit" class="quiz__check">Check answer</button>
    <button type="button" class="quiz__reset" data-quiz-reset hidden>Try again</button>
  </div>
  <output class="quiz__result" role="status" aria-live="polite" data-quiz-result></output>${explainHtml}
  <noscript>
    <details class="quiz__noscript">
      <summary>Show answer</summary>
      <p><strong>Answer:</strong> ${answerList}</p>
      ${explain ? `<p>${inline(explain)}</p>` : ''}
    </details>
  </noscript>
</form>`
}
