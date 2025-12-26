type Listener = (online: boolean) => void;

export class OnlineManager {
    private listeners = new Set<Listener>();
    private online = true;

    constructor() {
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('online', () => this.setOnline(true), false);
            window.addEventListener('offline', () => this.setOnline(false), false);
            this.online = navigator.onLine;
        }
    }

    private setOnline(online: boolean) {
        this.online = online;
        this.listeners.forEach(listener => listener(online));
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    isOnline(): boolean {
        return this.online;
    }
}

export const onlineManager = new OnlineManager();
