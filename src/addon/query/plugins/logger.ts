export interface Logger {
    log: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
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
