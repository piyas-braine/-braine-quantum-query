/**
 * QueryKey Trie
 * A specialized data structure for O(K) hierarchical lookups of Query Keys.
 * Replaces O(N) linear scans with efficient tree traversal.
 */
import { stableHash } from './utils';
import { type QueryKeyInput, type QueryKey } from './queryStorage';

export class TrieNode {
    children = new Map<string, TrieNode>();
    keys = new Set<string>(); // Stores the full hashed keys valid at this path
}

export class QueryKeyTrie {
    private root = new TrieNode();

    insert(queryKey: QueryKeyInput, hashedKey: string): void {
        const parts = this.normalizeParts(queryKey);
        let node = this.root;

        for (const part of parts) {
            const hash = stableHash(part);
            let child = node.children.get(hash);
            if (!child) {
                child = new TrieNode();
                node.children.set(hash, child);
            }
            node = child;
        }

        node.keys.add(hashedKey);
    }

    remove(queryKey: QueryKeyInput, hashedKey: string): void {
        const parts = this.normalizeParts(queryKey);
        this.removeRecursive(this.root, parts, 0, hashedKey);
    }

    private removeRecursive(node: TrieNode, parts: unknown[], index: number, hashedKey: string): boolean {
        if (index === parts.length) {
            node.keys.delete(hashedKey);
            return node.children.size === 0 && node.keys.size === 0;
        }

        const part = parts[index];
        const hash = stableHash(part);
        const child = node.children.get(hash);

        if (child) {
            const shouldDeleteChild = this.removeRecursive(child, parts, index + 1, hashedKey);
            if (shouldDeleteChild) {
                node.children.delete(hash);
            }
        }

        // Return true if this node is now empty and should be deleted
        return node.children.size === 0 && node.keys.size === 0;
    }

    /**
     * Get all hashed keys that match the given partial query key (prefix)
     */
    getMatchingKeys(partialKey: QueryKeyInput): Set<string> {
        const parts = this.normalizeParts(partialKey);
        let node = this.root;

        // 1. Traverse down to the target node
        for (const part of parts) {
            const hash = stableHash(part);
            const child = node.children.get(hash);
            if (!child) {
                return new Set(); // No matches
            }
            node = child;
        }

        // 2. Collect all keys from this node and below
        const results = new Set<string>();
        this.collectKeys(node, results);
        return results;
    }

    private collectKeys(node: TrieNode, results: Set<string>): void {
        for (const key of node.keys) {
            results.add(key);
        }
        for (const child of node.children.values()) {
            this.collectKeys(child, results);
        }
    }

    private normalizeParts(queryKey: QueryKeyInput): unknown[] {
        if (Array.isArray(queryKey)) {
            return queryKey;
        }
        // Object format { key: ..., params: ... } handled as two parts
        if (queryKey && typeof queryKey === 'object' && 'key' in queryKey) {
            const qk = queryKey as QueryKey;
            return [qk.key, qk.params];
        }
        return [queryKey];
    }
}
