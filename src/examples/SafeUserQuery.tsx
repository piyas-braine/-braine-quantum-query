import React from 'react';
import { useQuery } from '../addon/query';
import { z } from 'zod';

// 1. Define your schema (Single Source of Truth)
const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'user']),
});

// 2. Infer the type (Optional, but useful)
type User = z.infer<typeof UserSchema>;

export function SafeUserQuery() {
    // 3. Use the hook with the schema
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['user', 1],
        queryFn: async () => {
            // simulate API call
            const res = await fetch('/api/user/1');
            return res.json();
        },
        schema: UserSchema // <--- Runtime Validation!
    });

    if (isLoading) return <div>Loading...</div>;
    if (isError) return <div>Error: {error?.message}</div>;

    // 4. Enjoy 100% Type Safety
    // 'data' is strictly typed as 'User'. No 'any', no casting.
    return (
        <div>
            <h1>{data?.name}</h1>
            <p>{data?.email}</p>
            <span className="badge">{data?.role}</span>
        </div>
    );
}
