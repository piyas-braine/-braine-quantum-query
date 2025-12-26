import { describe, it, expect, vi } from 'vitest';
import { defineModel } from '../src/store/model';
import { useStore } from '../src/react/autoHook';

describe('defineModel', () => {
    it('should bind actions to state', () => {
        const model = defineModel({
            state: { count: 0 },
            actions: {
                inc() {
                    this.count++;
                }
            }
        });

        model.inc();
        expect(model.count).toBe(1);
    });

    it('should support computed properties', () => {
        const model = defineModel({
            state: { items: [1, 2, 3] },
            computed: {
                doubled() {
                    return this.items.map((x: number) => x * 2);
                },
                sum() {
                    return this.items.reduce((a: number, b: number) => a + b, 0);
                }
            },
            actions: {
                add(n: number) {
                    this.items.push(n);
                }
            }
        });

        expect(model.sum).toBe(6);
        expect(model.doubled).toEqual([2, 4, 6]);

        model.add(4);
        expect(model.sum).toBe(10);
        expect(model.doubled).toEqual([2, 4, 6, 8]);
    });

    it('should support async actions (optimistic updates)', async () => {
        const api = {
            post: vi.fn().mockResolvedValue('ok')
        };

        const model = defineModel({
            state: {
                status: 'idle',
                data: [] as string[]
            },
            actions: {
                async create(text: string) {
                    // Optimistic
                    this.data.push(text);
                    this.status = 'saving';

                    await api.post(text);

                    this.status = 'saved';
                }
            }
        });

        const promise = model.create('test');

        // Immediate check (Optimistic)
        expect(model.data).toContain('test');
        expect(model.status).toBe('saving');

        await promise;

        // Final check
        expect(model.status).toBe('saved');
        expect(api.post).toHaveBeenCalledWith('test');
    });
});
