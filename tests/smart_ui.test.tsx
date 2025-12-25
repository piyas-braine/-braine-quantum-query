import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // Import for side effects
import React from 'react';
import { CrudApp, CrudModel } from '../src/examples/SmartModelCRUD';

describe('SmartModel CRUD UI', () => {
    it('should handle full lifecycle: Input -> Add -> Optimistic -> Done -> Delete', async () => {
        render(<CrudApp />);

        const input = screen.getByTestId('input');
        const btn = screen.getByTestId('add-btn');
        const status = screen.getByTestId('status');

        // 1. Check Initial State
        expect(screen.queryByTestId('item')).toBeNull();
        expect(status.textContent).toBe('idle');
        expect(btn).toBeDisabled(); // isValid computed property working?

        // 2. Input State (Sync -> Async Batching)
        fireEvent.change(input, { target: { value: 'New Task' } });

        // State updates are batched via microtask, so we wait.
        await waitFor(() => {
            expect(input).toHaveValue('New Task');
            expect(btn).not.toBeDisabled();
        });

        // 3. Add (Async Optimistic)
        fireEvent.click(btn);

        // IMMEDIATE (Optimistic) assertions - also batched
        await waitFor(() => {
            expect(input).toHaveValue(''); // Input cleared properly?
            expect(screen.getByText('New Task')).toBeInTheDocument(); // Item added?
            expect(status.textContent).toBe('saving'); // Status updated?
        });

        // 4. Wait for API (Async)
        await waitFor(() => {
            expect(status.textContent).toBe('idle');
        });

        // Item should still be there
        expect(screen.getByText('New Task')).toBeInTheDocument();

        // 5. Delete
        fireEvent.click(screen.getByTestId('delete-New Task'));

        await waitFor(() => {
            expect(screen.queryByText('New Task')).toBeNull();
        });
    });
});
