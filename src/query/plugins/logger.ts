export interface Logger {
    log: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
}

const consoleLogger: Logger = {
    log: console.log,
    warn: console.warn,
    error: console.error,
};

let currentLogger: Logger = consoleLogger;

export const setLogger = (logger: Logger) => {
    currentLogger = logger;
};

export const getLogger = () => currentLogger;

// Usage: getLogger().error("...")
