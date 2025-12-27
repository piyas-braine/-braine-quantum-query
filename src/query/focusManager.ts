type Listener = () => void;

export class FocusManager {
    private listeners = new Set<Listener>();
    private focused = true;
    private unsubscribe: (() => void) | null = null;

    constructor() {
        if (typeof window !== 'undefined' && window.addEventListener) {
            const handleFocus = () => {
                this.focused = true;
                this.onFocus();
            };
            const handleBlur = () => {
                this.focused = false;
            };

            window.addEventListener('focus', handleFocus, false);
            window.addEventListener('visibilitychange', handleFocus, false);
            window.addEventListener('blur', handleBlur, false);

            this.unsubscribe = () => {
                window.removeEventListener('focus', handleFocus);
                window.removeEventListener('visibilitychange', handleFocus);
                window.removeEventListener('blur', handleBlur);
            };
        }
    }

    private onFocus() {
        this.listeners.forEach(listener => listener());
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    isFocused(): boolean {
        return this.focused;
    }

    setFocused(focused: boolean) {
        const wasUnfocused = !this.focused;
        this.focused = focused;
        // Only trigger listeners if we're transitioning from unfocused to focused
        if (focused && wasUnfocused) {
            this.onFocus();
        }
    }
}

export const focusManager = new FocusManager();
