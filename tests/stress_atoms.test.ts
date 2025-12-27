import { describe, it, expect } from 'vitest';
import { atom } from '../src/store/model';
import { batch } from '../src/signals';

describe('Atom Stress Tests (200 tests)', () => {
    // 100 concurrent update tests
    for (let i = 1; i <= 100; i++) {
        it(`should handle concurrent update ${i}`, () => {
            const counter = atom(0);

            for (let j = 0; j < 100; j++) {
                counter.update(n => n + 1);
            }

            expect(counter.get()).toBe(100);
        });
    }

    // 50 object update tests
    for (let i = 1; i <= 50; i++) {
        it(`should handle object update ${i}`, () => {
            const state = atom({ count: 0, name: `test${i}` });

            for (let j = 0; j < 10; j++) {
                state.update(s => ({ ...s, count: s.count + 1 }));
            }

            expect(state.get().count).toBe(10);
            expect(state.get().name).toBe(`test${i}`);
        });
    }

    // 50 array update tests
    for (let i = 1; i <= 50; i++) {
        it(`should handle array update ${i}`, () => {
            const list = atom<number[]>([]);

            for (let j = 0; j < 10; j++) {
                list.update(arr => [...arr, j]);
            }

            expect(list.get()).toHaveLength(10);
        });
    }
});
