import { useCallback } from 'react'
import { useLocalStorageState } from './useLocalStorageState'
import type { Bar } from '../types'

const STORAGE_KEY = 'notey.bars'

export function useBars() {
  const [bars, setBars] = useLocalStorageState<Bar[]>(STORAGE_KEY, [])

  const addBar = useCallback(() => {
    const bar: Bar = {
      id: crypto.randomUUID(),
      text: '',
      isTodo: false,
      done: false,
      createdAt: Date.now(),
    }
    setBars((prev) => [...prev, bar])
    return bar.id
  }, [setBars])

  const updateText = useCallback(
    (id: string, text: string) => {
      setBars((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)))
    },
    [setBars],
  )

  const toggleTodo = useCallback(
    (id: string) => {
      setBars((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, isTodo: !b.isTodo, done: b.isTodo ? false : b.done }
            : b,
        ),
      )
    },
    [setBars],
  )

  const toggleDone = useCallback(
    (id: string) => {
      setBars((prev) =>
        prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b)),
      )
    },
    [setBars],
  )

  const deleteBar = useCallback(
    (id: string) => {
      setBars((prev) => prev.filter((b) => b.id !== id))
    },
    [setBars],
  )

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setBars((prev) => {
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev
        }
        const next = prev.slice()
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
    },
    [setBars],
  )

  return { bars, addBar, updateText, toggleTodo, toggleDone, deleteBar, reorder }
}
