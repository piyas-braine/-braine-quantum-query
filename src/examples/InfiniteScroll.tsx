/**
 * Infinite Scroll Example
 * Demonstrates cursor-based pagination with useInfiniteQuery
 */

import React, { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '../query';
import { createHttpClient } from '../httpClient';

const api = createHttpClient({ baseURL: 'https://api.example.com' });

interface Post {
    id: string;
    title: string;
    content: string;
}

interface PostsResponse {
    posts: Post[];
    nextCursor?: string;
}

export function InfiniteScrollFeed() {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error
    } = useInfiniteQuery<PostsResponse>({
        queryKey: ['posts'],
        queryFn: ({ pageParam = null }) =>
            api.get(`/posts${pageParam ? `?cursor=${pageParam}` : ''}`),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: null,
        staleTime: 60000 // 1 minute
    });

    const sentinelRef = useRef<HTMLDivElement>(null);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { threshold: 1.0 }
        );

        observer.observe(sentinelRef.current);

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (isLoading) {
        return <div>Loading feed...</div>;
    }

    if (isError) {
        return <div>Error: {error?.message}</div>;
    }

    const allPosts = data?.pages.flatMap((page) => page.posts) || [];

    return (
        <div className="feed">
            <h2>Social Feed</h2>

            {allPosts.map((post) => (
                <article key={post.id} className="post">
                    <h3>{post.title}</h3>
                    <p>{post.content}</p>
                </article>
            ))}

            {isFetchingNextPage && <div>Loading more...</div>}

            {/* Sentinel element for intersection observer */}
            <div ref={sentinelRef} style={{ height: '20px' }} />

            {!hasNextPage && <div>No more posts</div>}
        </div>
    );
}
