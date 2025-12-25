const pending = new Set<() => void>();
let timer: any = null;

function flush() {
    timer = null;
    const tasks = [...pending];
    pending.clear();
    tasks.forEach(task => task());
}

export function scheduleUpdate(callback: () => void) {
    pending.add(callback);
    if (!timer) {
        timer = Promise.resolve().then(flush);
    }
}
