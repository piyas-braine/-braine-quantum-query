/**
 * Cross-Tab Synchronization using BroadcastChannel
 * Enables multi-tab coordination and cache invalidation
 */

export enum BroadcastMessageType {
    INVALIDATE = 'invalidate',
    INVALIDATE_ALL = 'invalidate_all',
    INVALIDATE_TAG = 'invalidate_tag',
    MUTATION = 'mutation',
    REFETCH = 'refetch'
}

export interface BroadcastMessage {
    type: BroadcastMessageType;
    payload: unknown;
    timestamp: number;
    tabId: string;
}

export type BroadcastHandler = (message: BroadcastMessage) => void;

export class CrossTabSync {
    private channel: BroadcastChannel | null = null;
    private handlers: Set<BroadcastHandler> = new Set();
    private tabId: string;
    private enabled: boolean;

    constructor(channelName: string = 'quantum-query') {
        this.tabId = this.generateTabId();
        this.enabled = typeof BroadcastChannel !== 'undefined';

        if (this.enabled) {
            try {
                this.channel = new BroadcastChannel(channelName);
                this.channel.addEventListener('message', this.handleMessage);
            } catch (e) {
                console.warn('[Quantum] BroadcastChannel not available:', e);
                this.enabled = false;
            }
        }
    }

    /**
     * Subscribe to cross-tab messages
     */
    subscribe(handler: BroadcastHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    /**
     * Broadcast a message to other tabs
     */
    broadcast(type: BroadcastMessageType, payload: unknown): void {
        if (!this.enabled || !this.channel) return;

        const message: BroadcastMessage = {
            type,
            payload,
            timestamp: Date.now(),
            tabId: this.tabId
        };

        try {
            this.channel.postMessage(message);
        } catch (e) {
            console.error('[Quantum] Broadcast error:', e);
        }
    }

    /**
     * Invalidate query in all tabs
     */
    invalidateQuery(queryKey: unknown[]): void {
        this.broadcast(BroadcastMessageType.INVALIDATE, { queryKey });
    }

    /**
     * Invalidate all queries in all tabs
     */
    invalidateAll(): void {
        this.broadcast(BroadcastMessageType.INVALIDATE_ALL, {});
    }

    /**
     * Invalidate queries by tag in all tabs
     */
    invalidateByTag(tag: string): void {
        this.broadcast(BroadcastMessageType.INVALIDATE_TAG, { tag });
    }

    /**
     * Notify other tabs of mutation
     */
    notifyMutation(mutationKey: unknown[], data: unknown): void {
        this.broadcast(BroadcastMessageType.MUTATION, { mutationKey, data });
    }

    /**
     * Request refetch in all tabs
     */
    requestRefetch(queryKey: unknown[]): void {
        this.broadcast(BroadcastMessageType.REFETCH, { queryKey });
    }

    private handleMessage = (event: MessageEvent<BroadcastMessage>) => {
        const message = event.data;

        // Ignore messages from this tab
        if (message.tabId === this.tabId) return;

        // Notify all handlers
        this.handlers.forEach(handler => {
            try {
                handler(message);
            } catch (e) {
                console.error('[Quantum] Broadcast handler error:', e);
            }
        });
    };

    private generateTabId(): string {
        return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if cross-tab sync is available
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.channel) {
            this.channel.removeEventListener('message', this.handleMessage);
            this.channel.close();
            this.channel = null;
        }
        this.handlers.clear();
    }
}

/**
 * Global cross-tab sync instance
 */
export const crossTabSync = new CrossTabSync();
