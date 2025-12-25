/**
 * Paginated List Example
 * Demonstrates offset-based pagination with usePaginatedQuery
 */

import React from 'react';
import { usePaginatedQuery } from '../addon/query';
import { createHttpClient } from '../addon/httpClient';

const api = createHttpClient({ baseURL: 'https://api.example.com' });

interface User {
    id: string;
    name: string;
    email: string;
}

export function PaginatedUserList() {
    const {
        data,
        isLoading,
        isError,
        error,
        page,
        nextPage,
        previousPage,
        hasNext,
        hasPrevious,
        refetch
    } = usePaginatedQuery<User[]>({
        queryKey: ['users'],
        queryFn: (pageNum) => api.get(`/users?page=${pageNum}&limit=20`),
        pageSize: 20,
        staleTime: 30000, // 30 seconds
        cacheTime: 300000 // 5 minutes
    });

    if (isLoading) {
        return <div>Loading users...</div>;
    }

    if (isError) {
        return (
            <div>
                <p>Error: {error?.message}</p>
                <button onClick={refetch}>Retry</button>
            </div>
        );
    }

    return (
        <div>
            <div className="toolbar">
                <button onClick={refetch}>Refresh</button>
                <span>Page {page + 1}</span>
            </div>

            <ul>
                {data?.map((user) => (
                    <li key={user.id}>
                        <strong>{user.name}</strong> - {user.email}
                    </li>
                ))}
            </ul>

            <div className="pagination">
                <button onClick={previousPage} disabled={!hasPrevious}>
                    Previous
                </button>
                <button onClick={nextPage} disabled={!hasNext}>
                    Next
                </button>
            </div>
        </div>
    );
}
