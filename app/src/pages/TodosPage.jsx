import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function TodosPage() {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    async function getTodos() {
      const { data: todos, error } = await supabase.from('todos').select()

      if (error) {
        console.error('Error fetching todos:', error)
      } else if (todos) {
        setTodos(todos)
      }
    }

    getTodos()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Todo List (Supabase)</h1>
      <ul className="list-disc pl-5">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
        {todos.length === 0 && <li>No todos found. Make sure the 'todos' table exists and has data.</li>}
      </ul>
    </div>
  )
}
