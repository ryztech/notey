import { BarList } from './components/BarList'
import { useBars } from './hooks/useBars'

function App() {
  const { bars, addBar, updateText, toggleTodo, toggleDone, deleteBar, reorder } =
    useBars()

  return (
    <BarList
      bars={bars}
      addBar={addBar}
      updateText={updateText}
      toggleTodo={toggleTodo}
      toggleDone={toggleDone}
      deleteBar={deleteBar}
      reorder={reorder}
    />
  )
}

export default App
