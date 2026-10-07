import { useRef, useState } from 'react'
import { Bar } from './Bar'
import type { Bar as BarType } from '../types'
import styles from './BarList.module.css'

interface BarListProps {
  bars: BarType[]
  addBar: () => string
  addBarAfter: (afterId: string) => string
  updateText: (id: string, text: string) => void
  toggleTodo: (id: string) => void
  toggleDone: (id: string) => void
  deleteBar: (id: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
}

export function BarList({
  bars,
  addBar,
  addBarAfter,
  updateText,
  toggleTodo,
  toggleDone,
  deleteBar,
  reorder,
}: BarListProps) {
  const [focusId, setFocusId] = useState<string | null>(null)
  const rowElements = useRef<Map<string, HTMLDivElement>>(new Map())

  function registerRef(id: string, el: HTMLDivElement | null) {
    if (el) rowElements.current.set(id, el)
    else rowElements.current.delete(id)
  }

  // Index is computed relative to the list with the dragged bar removed —
  // matching what reorder() expects (remove, then insert at this index) —
  // rather than relative to the full array, which previously caused an
  // off-by-one overshoot whenever dragging a bar downward.
  function getIndexForY(clientY: number, excludeId: string) {
    let insertIndex = 0
    let seen = 0
    for (const bar of bars) {
      if (bar.id === excludeId) continue
      const el = rowElements.current.get(bar.id)
      if (el) {
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        if (clientY > mid) insertIndex = seen + 1
      }
      seen++
    }
    return insertIndex
  }

  // The dragged bar never moves in the real list while the gesture is in
  // progress (it only floats visually via a transform — see Bar.tsx), so
  // sibling rects stay stable for the whole drag and the final position is
  // computed fresh from wherever the pointer ends up, however far that is.
  function handleDragEnd(id: string, clientY: number) {
    const fromIndex = bars.findIndex((b) => b.id === id)
    if (fromIndex === -1) return
    const toIndex = getIndexForY(clientY, id)
    if (toIndex !== fromIndex) {
      reorder(fromIndex, toIndex)
    }
  }

  function handleAdd() {
    const id = addBar()
    setFocusId(id)
  }

  function handleEnterNewRow(afterId: string) {
    const id = addBarAfter(afterId)
    setFocusId(id)
  }

  return (
    <div className={styles.list}>
      {bars.map((bar) => (
        <Bar
          key={bar.id}
          bar={bar}
          autoFocus={bar.id === focusId}
          onRef={registerRef}
          onUpdateText={updateText}
          onToggleTodo={toggleTodo}
          onToggleDone={toggleDone}
          onDelete={deleteBar}
          onDragEnd={handleDragEnd}
          onFocusHandled={() => setFocusId(null)}
          onEnterNewRow={handleEnterNewRow}
        />
      ))}
      <button type="button" className={styles.addRow} onClick={handleAdd}>
        [+ add]
      </button>
    </div>
  )
}
