import { useRef, useState } from 'react'
import { Bar } from './Bar'
import type { Bar as BarType } from '../types'
import styles from './BarList.module.css'

interface BarListProps {
  bars: BarType[]
  addBar: () => string
  updateText: (id: string, text: string) => void
  toggleTodo: (id: string) => void
  toggleDone: (id: string) => void
  deleteBar: (id: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
}

export function BarList({
  bars,
  addBar,
  updateText,
  toggleTodo,
  toggleDone,
  deleteBar,
  reorder,
}: BarListProps) {
  const [focusId, setFocusId] = useState<string | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const rowElements = useRef<Map<string, HTMLDivElement>>(new Map())

  function registerRef(id: string, el: HTMLDivElement | null) {
    if (el) rowElements.current.set(id, el)
    else rowElements.current.delete(id)
  }

  function getIndexForY(clientY: number, excludeId: string) {
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].id === excludeId) continue
      const el = rowElements.current.get(bars[i].id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) return i
    }
    return bars.length - 1
  }

  function handleDragStart(id: string) {
    draggingIdRef.current = id
  }

  function handleDragMove(clientY: number) {
    const draggingId = draggingIdRef.current
    if (!draggingId) return
    const fromIndex = bars.findIndex((b) => b.id === draggingId)
    if (fromIndex === -1) return
    const toIndex = getIndexForY(clientY, draggingId)
    if (toIndex !== fromIndex) {
      reorder(fromIndex, toIndex)
    }
  }

  function handleDragEnd() {
    draggingIdRef.current = null
  }

  function handleAdd() {
    const id = addBar()
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
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onFocusHandled={() => setFocusId(null)}
        />
      ))}
      <button type="button" className={styles.addRow} onClick={handleAdd}>
        [+ add]
      </button>
    </div>
  )
}
