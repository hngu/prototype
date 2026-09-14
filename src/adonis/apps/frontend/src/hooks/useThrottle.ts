import { useCallback, useRef, useEffect } from 'react'
/**
 * Calls expensive function right away, then won't call
 * until X period has passed
 *
 * @param callback
 * @param delay
 * @returns
 */
export const useThrottle = (callback, delay = 500) => {
  let isThrottled = useRef(false)
  let fnRef = useRef(callback)

  useEffect(() => {
    fnRef.current = callback
  })

  return useCallback(
    (...args) => {
      if (isThrottled.current) {
        return
      }

      isThrottled.current = true
      fnRef.current(...args)

      setTimeout(() => {
        isThrottled.current = false
      }, delay)
    },
    [delay]
  )
}

/**
 * Invokes at most once per `delay` ms (leading and trailing).
 * The first call runs immediately; if it is invoked again during
 * the wait, the latest arguments run once when the window ends.
 *
 * @param callback
 * @param delay
 * @returns
 */
export const useThrottledCallback = (callback, delay = 500) => {
  const timeoutRef = useRef(null)
  const lastInvokedRef = useRef(0)
  const lastArgsRef = useRef(null)
  const fnRef = useRef(callback)

  useEffect(() => {
    fnRef.current = callback
  })

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [delay])

  return useCallback(
    (...args) => {
      const now = Date.now()
      const remaining = delay - (now - lastInvokedRef.current)

      lastArgsRef.current = args

      const invoke = () => {
        lastInvokedRef.current = Date.now()
        fnRef.current(...lastArgsRef.current)
      }

      if (remaining <= 0 || remaining > delay) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        invoke()
        return
      }

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          invoke()
        }, remaining)
      }
    },
    [delay]
  )
}
