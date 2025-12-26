/**
 * Optimistic Todo Example
 * Demonstrates optimistic updates with automatic rollback
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '../query';
import { createHttpClient } from '../httpClient';

const api = createHttpClient({ baseURL: 'https://api.example.com' });

interface Todo {
    id: string;
    text: string;
    completed: boolean;
}

export function OptimisticTodoList() {
    const [newTodoText, setNewTodoText] = useState('');
    const client = useQueryClient();

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

        optimistic: {
            queryKey: ['todos'],
            update: (variables, oldData) => {
                const old = (oldData as Todo[]) || [];
                return [
                    ...old,
                    {
                        id: `temp-${Date.now()}`,
                        text: variables.text,
                        completed: false
                    }
                ];
            }
        },

        onSuccess: () => {
            // Invalidate and refetch to get server data
            client.invalidate(['todos']);
            refetch();
        }
    });

    // Toggle todo mutation
    const toggleTodo = useMutation<Todo, { id: string }>({
        mutationFn: (vars) => api.patch(`/todos/${vars.id}/toggle`, {}),

        optimistic: {
            queryKey: ['todos'],
            update: (variables, oldData) => {
                const old = (oldData as Todo[]) || [];
                return old.map(todo =>
                    todo.id === variables.id
                        ? { ...todo, completed: !todo.completed }
                        : todo
                );
            }
        },

        onSettled: () => {
            client.invalidate(['todos']);
        }
    });

    // Delete todo mutation
    const deleteTodo = useMutation<void, { id: string }>({
        mutationFn: (vars) => api.delete(`/todos/${vars.id}`),

        optimistic: {
            queryKey: ['todos'],
            update: (variables, oldData) => {
                const old = (oldData as Todo[]) || [];
                return old.filter(todo => todo.id !== variables.id);
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
