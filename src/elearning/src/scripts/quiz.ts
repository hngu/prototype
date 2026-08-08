/**
 * Progressive enhancement for quiz blocks. No framework, no dependencies.
 *
 * The markup is already complete and readable without this file — it only adds
 * grading. With JS off, the <noscript><details> fallback still reveals the answer.
 */

type Mode = 'single' | 'multi' | 'true-false'

function gradeInput(input: HTMLInputElement): 'correct' | 'incorrect' | 'missed' | null {
  const shouldBeChecked = input.dataset['correct'] === 'true'
  if (input.checked) return shouldBeChecked ? 'correct' : 'incorrect'
  // Correct but unselected — only meaningful in multi-select.
  return shouldBeChecked ? 'missed' : null
}

function setup(form: HTMLFormElement): void {
  // Astro's dev HMR can re-run this module; without a guard we'd bind twice
  // and grade twice per submit.
  if (form.dataset['quizReady'] === 'true') return
  form.dataset['quizReady'] = 'true'

  const mode = (form.dataset['quizMode'] ?? 'single') as Mode
  const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('.quiz__input'))
  const result = form.querySelector<HTMLElement>('[data-quiz-result]')
  const explain = form.querySelector<HTMLElement>('[data-quiz-explain]')
  const resetBtn = form.querySelector<HTMLButtonElement>('[data-quiz-reset]')

  const clearStates = () => {
    for (const input of inputs) {
      const item = input.closest<HTMLElement>('.quiz__item')
      if (item) delete item.dataset['state']
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const selected = inputs.filter((i) => i.checked)

    if (selected.length === 0) {
      form.dataset['state'] = 'empty'
      if (result) result.textContent = 'Choose an answer first.'
      return
    }

    // Multi-select is graded all-or-nothing: every box must match its expected
    // state, so a partially correct answer is still wrong.
    const isCorrect =
      mode === 'multi'
        ? inputs.every((i) => i.checked === (i.dataset['correct'] === 'true'))
        : selected[0]!.dataset['correct'] === 'true'

    for (const input of inputs) {
      const item = input.closest<HTMLElement>('.quiz__item')
      if (!item) continue
      const state = gradeInput(input)
      // `missed` is only a useful signal when several boxes were expected.
      if (state && !(state === 'missed' && mode !== 'multi')) {
        item.dataset['state'] = state
      } else {
        delete item.dataset['state']
      }
    }

    form.dataset['state'] = isCorrect ? 'correct' : 'incorrect'

    if (result) {
      result.textContent = isCorrect
        ? 'Correct.'
        : mode === 'multi'
          ? 'Not quite — you need every correct option, and no incorrect ones.'
          : 'Not quite.'
    }

    if (explain) explain.hidden = false
    if (resetBtn) resetBtn.hidden = false

    // Focus deliberately stays on the Check button: the aria-live region
    // announces the verdict on its own, and moving focus mid-interaction is a
    // common accessibility regression. The button is never disabled either —
    // disabled controls drop out of the tab order and lose their accessible name.
  })

  resetBtn?.addEventListener('click', () => {
    form.reset()
    clearStates()
    delete form.dataset['state']
    if (result) result.textContent = ''
    if (explain) explain.hidden = true
    resetBtn.hidden = true
    inputs[0]?.focus()
  })
}

const init = () => {
  for (const form of document.querySelectorAll<HTMLFormElement>('[data-quiz]')) setup(form)
}

// Astro hoists and defers this script, so the DOM is normally ready already.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

// Re-run after client-side navigation if the View Transitions router is ever added.
document.addEventListener('astro:page-load', init)
