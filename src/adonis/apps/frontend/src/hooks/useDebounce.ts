import { useRef, useCallback, useEffect } from 'react'

/**
 * Calls expensive function once after X delay of inactivity
 * @param callback
 * @param delay
 * @returns
 */
export const useDebounce = (callback, delay = 500) => {
  // use refs so these survive between renders
  const timeoutRef = useRef(null)
  const fnRef = useRef(callback)

  // clear timeout on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  // update fnRef on every render to get latest callback
  useEffect(() => {
    fnRef.current = callback
  })

  return useCallback(
    (...args) => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        fnRef.current(...args)
      }, delay)
    },
    [delay]
  )
}
