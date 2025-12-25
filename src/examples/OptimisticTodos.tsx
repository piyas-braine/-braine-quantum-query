/**
 * Optimistic Todo Example
 * Demonstrates optimistic updates with automatic rollback
 */

import React, { useState } from 'react';
import { useQuery, useMutation, optimisticHelpers } from '../addon/query';
import { createHttpClient } from '../addon/httpClient';

const api = createHttpClient({ baseURL: 'https://api.example.com' });

interface Todo {
    id: string;
    text: string;
    completed: boolean;
}

export function OptimisticTodoList() {
    const [newTodoText, setNewTodoText] = useState('');

    // Fetch todos with auto-refetch on focus
    const { data: todos, isLoading, refetch } = useQuery<Todo[]>({
        queryKey: ['todos'],
        queryFn: () => api.get('/todos'),
        staleTime: 30000,
        refetchOnWindowFocus: true
    });

    // Add todo mutation with optimistic update
    const addTodo = useMutation<Todo, { text: string }>({
        mutationFn: (vars) => api.post('/todos', vars),

        onMutate: async (variables) => {
            // Cancel ongoing queries
            await optimisticHelpers.cancelQueries(['todos']);

            // Snapshot current value
            const previous = optimisticHelpers.getQueryData<Todo[]>(['todos']);

            // Optimistically add new todo
            optimisticHelpers.setQueryData<Todo[]>(['todos'], (old = []) => [
                ...old,
                {
                    id: `temp-${Date.now()}`,
                    text: variables.text,
                    completed: false
                }
            ]);

            return { previous };
        },

        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previous) {
                optimisticHelpers.setQueryData(['todos'], context.previous);
            }
        },

        onSuccess: () => {
            // Invalidate and refetch to get server data
            optimisticHelpers.invalidateQueries(['todos']);
            refetch();
        }
    });

    // Toggle todo mutation
    const toggleTodo = useMutation<Todo, { id: string }>({
        mutationFn: (vars) => api.patch(`/todos/${vars.id}/toggle`, {}),

        onMutate: async (variables) => {
            const previous = optimisticHelpers.getQueryData<Todo[]>(['todos']);

            // Optimistically toggle
            optimisticHelpers.setQueryData<Todo[]>(['todos'], (old = []) =>
                old.map(todo =>
                    todo.id === variables.id
                        ? { ...todo, completed: !todo.completed }
                        : todo
                )
            );

            return { previous };
        },

        onError: (err, variables, context) => {
            if (context?.previous) {
                optimisticHelpers.setQueryData(['todos'], context.previous);
            }
        }
    });

    // Delete todo mutation
    const deleteTodo = useMutation<void, { id: string }>({
        mutationFn: (vars) => api.delete(`/todos/${vars.id}`),

        onMutate: async (variables) => {
            const previous = optimisticHelpers.getQueryData<Todo[]>(['todos']);

            // Optimistically remove
            optimisticHelpers.setQueryData<Todo[]>(['todos'], (old = []) =>
                old.filter(todo => todo.id !== variables.id)
            );

            return { previous };
        },

        onError: (err, variables, context) => {
            if (context?.previous) {
                optimisticHelpers.setQueryData(['todos'], context.previous);
            }
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodoText.trim()) return;

        addTodo.mutate({ text: newTodoText });
        setNewTodoText('');
    };

    if (isLoading) {
        return <div>Loading todos...</div>;
    }

    return (
        <div>
            <h2>Optimistic Todo List</h2>

            <form onSubmit={handleSubmit}>
                <input
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    placeholder="Add a todo..."
                />
                <button type="submit" disabled={addTodo.isLoading}>
                    {addTodo.isLoading ? 'Adding...' : 'Add'}
                </button>
            </form>

            {addTodo.isError && (
                <div className="error">Error: {addTodo.error?.message}</div>
            )}

            <ul>
                {todos?.map((todo) => (
                    <li key={todo.id}>
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => toggleTodo.mutate({ id: todo.id })}
                        />
                        <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                            {todo.text}
                        </span>
                        <button onClick={() => deleteTodo.mutate({ id: todo.id })}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
