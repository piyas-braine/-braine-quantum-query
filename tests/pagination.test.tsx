import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaginatedQuery } from '../src/addon/query/pagination';
import { QueryCache } from '../src/addon/query/queryCache';
import { QueryClientProvider } from '../src/addon/query/context';
import React from 'react';

describe('usePaginatedQuery', () => {
    let client: QueryCache;
    let wrapper: React.FC<{ children: React.ReactNode }>;

    beforeEach(() => {
        client = new QueryCache();
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        vi.clearAllMocks();
    });

    it('should fetch initial page', async () => {
        const mockFn = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                pageSize: 20
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
        expect(result.current.page).toBe(0);
        expect(mockFn).toHaveBeenCalledWith(0);
    });

    it('should navigate to next page', async () => {
        const mockFn = vi.fn()
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
            .mockResolvedValueOnce([{ id: 3 }, { id: 4 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                pageSize: 2
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            result.current.nextPage();
        });

        await waitFor(() => expect(result.current.page).toBe(1));
        expect(result.current.data).toEqual([{ id: 3 }, { id: 4 }]);
        expect(mockFn).toHaveBeenCalledWith(1);
    });

    it('should cache pages', async () => {
        const mockFn = vi.fn().mockResolvedValue([{ id: 1 }]);

        const { result, rerender } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                staleTime: 60000
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Remount - should use cache
        rerender();

        // Wait to ensure no new fetch happens
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should detect hasNext correctly', async () => {
        const mockFn = vi.fn()
            .mockResolvedValueOnce(Array(20).fill({ id: 1 })) // Full page
            .mockResolvedValueOnce([{ id: 1 }]); // Partial page

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                pageSize: 20
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.hasNext).toBe(true));

        await act(async () => {
            result.current.nextPage();
        });

        await waitFor(() => expect(result.current.hasNext).toBe(false));
    });

    it('should handle errors', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error?.message).toBe('Network error');
    });

    it('should refetch on demand', async () => {
        const mockFn = vi.fn()
            .mockResolvedValueOnce([{ id: 1 }])
            .mockResolvedValueOnce([{ id: 2 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]));

        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.data).toEqual([{ id: 2 }]));
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should respect enabled flag', async () => {
        const mockFn = vi.fn().mockResolvedValue([{ id: 1 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                enabled: false
            }),
            { wrapper }
        );

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockFn).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(true);
    });

    it('should handle previousPage', async () => {
        const mockFn = vi.fn().mockResolvedValue([{ id: 1 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                pageSize: 1
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            result.current.nextPage();
        });
        await waitFor(() => expect(result.current.page).toBe(1));

        await act(async () => {
            result.current.previousPage();
        });
        await waitFor(() => expect(result.current.page).toBe(0));
    });

    it('should have hasPrevious based on page', async () => {
        const mockFn = vi.fn().mockResolvedValue([{ id: 1 }]);

        const { result } = renderHook(() =>
            usePaginatedQuery({
                queryKey: ['items'],
                queryFn: mockFn,
                pageSize: 1
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.hasPrevious).toBe(false));

        await act(async () => {
            result.current.nextPage();
        });
        await waitFor(() => expect(result.current.hasPrevious).toBe(true));
    });
});
