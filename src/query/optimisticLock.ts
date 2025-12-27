/**
 * Optimistic Locking & Versioning System
 * Prevents race conditions with version tracking and conflict resolution
 */

export interface VersionedEntry<T> {
    data: T;
    version: number;
    timestamp: number;
}

export enum ConflictStrategy {
    /**
     * Last write wins - overwrite with new data
     */
    OVERWRITE = 'overwrite',

    /**
     * First write wins - keep existing data
     */
    KEEP_EXISTING = 'keep_existing',

    /**
     * Merge data (requires custom merge function)
     */
    MERGE = 'merge',

    /**
     * Throw error on conflict
     */
    ERROR = 'error'
}

export class OptimisticLock<T> {
    private currentVersion: number = 0;
    private data: T | undefined;
    private timestamp: number = Date.now();

    constructor(initialData?: T) {
        this.data = initialData;
        if (initialData !== undefined) {
            this.currentVersion = 1;
        }
    }

    /**
     * Get current data with version
     */
    read(): VersionedEntry<T> | undefined {
        if (this.data === undefined) return undefined;

        return {
            data: this.data,
            version: this.currentVersion,
            timestamp: this.timestamp
        };
    }

    /**
     * Optimistic write - succeeds only if version matches
     */
    write(
        newData: T,
        expectedVersion: number,
        strategy: ConflictStrategy = ConflictStrategy.ERROR
    ): { success: boolean; currentVersion: number; conflict?: boolean } {
        // Check version
        if (this.currentVersion !== expectedVersion) {
            // Version mismatch - conflict detected
            return this.handleConflict(newData, expectedVersion, strategy);
        }

        // Version matches - safe to write
        this.data = newData;
        this.currentVersion++;
        this.timestamp = Date.now();

        return {
            success: true,
            currentVersion: this.currentVersion
        };
    }

    /**
     * Force write - always succeeds, increments version
     */
    forceWrite(newData: T): number {
        this.data = newData;
        this.currentVersion++;
        this.timestamp = Date.now();
        return this.currentVersion;
    }

    private handleConflict(
        newData: T,
        expectedVersion: number,
        strategy: ConflictStrategy
    ): { success: boolean; currentVersion: number; conflict: true } {
        switch (strategy) {
            case ConflictStrategy.OVERWRITE:
                // Last write wins
                this.data = newData;
                this.currentVersion++;
                this.timestamp = Date.now();
                return {
                    success: true,
                    currentVersion: this.currentVersion,
                    conflict: true
                };

            case ConflictStrategy.KEEP_EXISTING:
                // First write wins - keep existing
                return {
                    success: false,
                    currentVersion: this.currentVersion,
                    conflict: true
                };

            case ConflictStrategy.ERROR:
            default:
                // Throw error
                throw new Error(
                    `Optimistic lock conflict: expected version ${expectedVersion}, current version ${this.currentVersion}`
                );
        }
    }

    /**
     * Get current version
     */
    getVersion(): number {
        return this.currentVersion;
    }
}

/**
 * Transaction support for atomic operations
 */
export class Transaction {
    private operations: Array<() => void> = [];
    private rollbackStack: Array<() => void> = [];
    private committed = false;

    /**
     * Add an operation to the transaction
     */
    add(operation: () => void, rollback: () => void): void {
        if (this.committed) {
            throw new Error('Cannot add operations to committed transaction');
        }
        this.operations.push(operation);
        this.rollbackStack.push(rollback);
    }

    /**
     * Execute all operations atomically
     */
    commit(): void {
        if (this.committed) {
            throw new Error('Transaction already committed');
        }

        try {
            // Execute all operations
            this.operations.forEach(op => op());
            this.committed = true;
        } catch (error) {
            // Rollback on error
            this.rollback();
            throw error;
        }
    }

    /**
     * Rollback all operations
     */
    rollback(): void {
        // Execute rollback operations in reverse order
        for (let i = this.rollbackStack.length - 1; i >= 0; i--) {
            const rollbackFn = this.rollbackStack[i];
            if (rollbackFn) {
                try {
                    rollbackFn();
                } catch (e) {
                    console.error('[Quantum] Rollback error:', e);
                }
            }
        }
    }
}
