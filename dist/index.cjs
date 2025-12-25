"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  HttpError: () => HttpError,
  computed: () => computed,
  createHttpClient: () => createHttpClient,
  createState: () => createState,
  defineModel: () => defineModel,
  enableDevTools: () => enableDevTools,
  getPromiseState: () => getPromiseState,
  handlePromise: () => handlePromise,
  isPromise: () => isPromise,
  scheduleUpdate: () => scheduleUpdate,
  subscribe: () => subscribe,
  unwrapPromise: () => unwrapPromise,
  useStore: () => useStore
});
module.exports = __toCommonJS(index_exports);

// src/core/scheduler.ts
var pending = /* @__PURE__ */ new Set();
var timer = null;
function flush() {
  timer = null;
  const tasks = [...pending];
  pending.clear();
  tasks.forEach((task) => task());
}
function scheduleUpdate(callback) {
  pending.add(callback);
  if (!timer) {
    timer = Promise.resolve().then(flush);
  }
}

// src/core/asyncUtils.ts
var PROMISE_CACHE = /* @__PURE__ */ new WeakMap();
var PROMISE_STATUS = /* @__PURE__ */ new WeakMap();
var PROMISE_ERROR = /* @__PURE__ */ new WeakMap();
function isPromise(value) {
  return !!value && typeof value.then === "function";
}
function handlePromise(promise, triggerUpdate) {
  if (PROMISE_STATUS.has(promise)) return;
  PROMISE_STATUS.set(promise, "pending");
  promise.then(
    (value) => {
      PROMISE_STATUS.set(promise, "fulfilled");
      PROMISE_CACHE.set(promise, value);
      triggerUpdate();
    },
    (error) => {
      PROMISE_STATUS.set(promise, "rejected");
      PROMISE_ERROR.set(promise, error);
      triggerUpdate();
    }
  );
}
function unwrapPromise(promise) {
  const status = PROMISE_STATUS.get(promise);
  if (status === "fulfilled") {
    return PROMISE_CACHE.get(promise);
  } else if (status === "rejected") {
    throw PROMISE_ERROR.get(promise);
  } else {
    throw promise;
  }
}
function getPromiseState(promise) {
  return {
    status: PROMISE_STATUS.get(promise) || "pending",
    value: PROMISE_CACHE.get(promise),
    error: PROMISE_ERROR.get(promise)
  };
}

// src/core/proxy.ts
var LISTENERS = /* @__PURE__ */ new WeakMap();
var PROXIES = /* @__PURE__ */ new WeakMap();
var activeListener = null;
function setActiveListener(listener) {
  activeListener = listener;
}
function getActiveListener() {
  return activeListener;
}
var GLOBAL_LISTENERS = /* @__PURE__ */ new WeakMap();
function subscribe(store, callback) {
  let listeners = GLOBAL_LISTENERS.get(store);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    GLOBAL_LISTENERS.set(store, listeners);
  }
  listeners.add(callback);
  return () => listeners?.delete(callback);
}
var handler = {
  get(target, prop, receiver) {
    if (activeListener) {
      let listeners = LISTENERS.get(target);
      if (!listeners) {
        listeners = /* @__PURE__ */ new Set();
        LISTENERS.set(target, listeners);
      }
      listeners.add(activeListener);
    }
    const value = Reflect.get(target, prop, receiver);
    if (isPromise(value)) {
      if (prop === "$state") {
      }
      return unwrapPromise(value);
    }
    if (typeof value === "object" && value !== null) {
      return createState(value);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const oldValue = Reflect.get(target, prop, receiver);
    if (Object.is(oldValue, value)) return true;
    if (isPromise(value)) {
      const trigger = () => {
        const listeners2 = LISTENERS.get(target);
        if (listeners2) listeners2.forEach((l) => l());
      };
      handlePromise(value, trigger);
    }
    const result = Reflect.set(target, prop, value, receiver);
    const listeners = LISTENERS.get(target);
    if (listeners) {
      listeners.forEach((l) => l());
    }
    const globals = GLOBAL_LISTENERS.get(target);
    if (globals) {
      globals.forEach((cb) => cb(target, prop, value));
    }
    return result;
  },
  deleteProperty(target, prop) {
    const result = Reflect.deleteProperty(target, prop);
    const listeners = LISTENERS.get(target);
    if (listeners) {
      listeners.forEach((l) => l());
    }
    return result;
  }
};
function createState(initialState) {
  if (PROXIES.has(initialState)) {
    return PROXIES.get(initialState);
  }
  const proxy = new Proxy(initialState, handler);
  PROXIES.set(initialState, proxy);
  return proxy;
}

// src/core/model.ts
function defineModel(def) {
  const target = def.state;
  if (def.actions) {
    for (const [key, fn] of Object.entries(def.actions)) {
      target[key] = fn;
    }
  }
  if (def.computed) {
    for (const [key, getter] of Object.entries(def.computed)) {
      if (typeof getter === "function") {
        Object.defineProperty(target, key, {
          get: function() {
            return getter.call(this);
          },
          enumerable: true,
          configurable: true
        });
      }
    }
  }
  return createState(target);
}

// src/react/autoHook.ts
var import_react = require("react");
function useStore(store) {
  const versionRef = (0, import_react.useRef)(0);
  const notifyRef = (0, import_react.useRef)(void 0);
  const listener = (0, import_react.useCallback)(() => {
    versionRef.current++;
    if (notifyRef.current) {
      notifyRef.current();
    }
  }, []);
  const subscribe2 = (0, import_react.useCallback)((onStoreChange) => {
    notifyRef.current = onStoreChange;
    return () => {
      notifyRef.current = void 0;
    };
  }, []);
  const getSnapshot = (0, import_react.useCallback)(() => versionRef.current, []);
  (0, import_react.useSyncExternalStore)(subscribe2, getSnapshot, getSnapshot);
  const proxy = new Proxy(store, {
    get(target, prop, receiver) {
      const prev = getActiveListener();
      setActiveListener(listener);
      try {
        return Reflect.get(target, prop, receiver);
      } finally {
        setActiveListener(prev);
      }
    }
  });
  return proxy;
}

// src/middleware/devtools.ts
function enableDevTools(store, name = "Store") {
  if (typeof window === "undefined" || !window.__REDUX_DEVTOOLS_EXTENSION__) return;
  const devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name });
  devTools.init(store);
  subscribe(store, (target, prop, value) => {
    devTools.send({ type: `SET_${String(prop)}`, payload: value }, store);
  });
}

// src/core/computed.ts
function computed(fn) {
  let value;
  let dirty = true;
  return {
    get value() {
      if (dirty) {
        value = fn();
        dirty = false;
      }
      return value;
    }
  };
}

// src/addon/httpClient.ts
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
};
function createHttpClient(config) {
  let isRefreshing = false;
  let refreshPromise = null;
  const inflightRequests = /* @__PURE__ */ new Map();
  const getRetryConfig = (reqConfig) => {
    const raw = reqConfig?.retry ?? config.retry;
    if (raw === void 0 || raw === 0) return null;
    if (typeof raw === "number") {
      return { retries: raw, baseDelay: 1e3, maxDelay: 5e3 };
    }
    return raw;
  };
  const client = {
    async request(endpoint, options = {}) {
      let url = config.baseURL ? `${config.baseURL}${endpoint}` : endpoint;
      const method = options.method || "GET";
      const isGet = method.toUpperCase() === "GET";
      const dedupeKey = isGet ? `${method}:${url}` : null;
      if (dedupeKey && inflightRequests.has(dedupeKey)) {
        return inflightRequests.get(dedupeKey);
      }
      const retryConfig = getRetryConfig(options);
      const timeoutMs = options.timeout ?? config.timeout ?? 1e4;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const userSignal = options.signal;
      let finalSignal = controller.signal;
      if (userSignal) {
        if (userSignal.aborted) {
          clearTimeout(id);
          throw new Error("Aborted");
        }
      }
      const executeBaseRequest = async (overrideToken) => {
        let headers = {
          "Content-Type": "application/json",
          ...config.headers,
          ...options.headers
        };
        if (overrideToken) {
          headers["Authorization"] = `Bearer ${overrideToken}`;
        } else if (config.auth) {
          const token = await config.auth.getToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }
        let requestConfig = {
          ...options,
          headers,
          signal: finalSignal
        };
        if (config.interceptors?.request) {
          requestConfig = await config.interceptors.request(requestConfig);
        }
        try {
          if (userSignal?.aborted) throw new DOMException("Aborted", "AbortError");
          let response = await fetch(url, requestConfig);
          if (config.interceptors?.response) {
            response = await config.interceptors.response(response);
          }
          return response;
        } catch (error) {
          throw error;
        }
      };
      const attemptRequest = async (attempt) => {
        try {
          const response = await executeBaseRequest();
          if (response.status === 401 && config.auth) {
            if (!isRefreshing) {
              isRefreshing = true;
              refreshPromise = config.auth.onTokenExpired(client).finally(() => {
                isRefreshing = false;
                refreshPromise = null;
              });
            }
            const newToken = await refreshPromise;
            if (newToken) {
              return executeBaseRequest(newToken);
            } else {
              config.auth.onAuthFailed?.();
              throw new HttpError(401, "Authentication Failed");
            }
          }
          if (!response.ok) {
            throw new HttpError(response.status, `HTTP Error ${response.status}`);
          }
          return response;
        } catch (error) {
          if (retryConfig && attempt < retryConfig.retries) {
            const isAbort = error.name === "AbortError";
            if (isAbort) throw error;
            if (error instanceof HttpError) {
              if (error.status < 500 && error.status !== 429) {
                throw error;
              }
            }
            const d = Math.min(
              retryConfig.baseDelay * 2 ** attempt,
              retryConfig.maxDelay
            );
            await delay(d);
            return attemptRequest(attempt + 1);
          }
          throw error;
        }
      };
      const execute = async () => {
        try {
          const response = await attemptRequest(0);
          clearTimeout(id);
          let data;
          if (response.status === 204) {
            data = {};
          } else {
            const text = await response.text();
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }
          if (options.schema) {
            try {
              if (options.schema.parse) {
                return options.schema.parse(data);
              } else if (options.schema.validateSync) {
                return options.schema.validateSync(data);
              }
            } catch (error) {
              throw new Error(`Validation Error: ${error}`);
            }
          }
          return data;
        } catch (err) {
          clearTimeout(id);
          throw err;
        }
      };
      const promise = execute();
      if (dedupeKey) {
        inflightRequests.set(dedupeKey, promise);
      }
      try {
        return await promise;
      } finally {
        if (dedupeKey) {
          inflightRequests.delete(dedupeKey);
        }
      }
    },
    get(url, config2) {
      return this.request(url, { ...config2, method: "GET" });
    },
    post(url, data, config2) {
      return this.request(url, { ...config2, method: "POST", body: JSON.stringify(data) });
    },
    put(url, data, config2) {
      return this.request(url, { ...config2, method: "PUT", body: JSON.stringify(data) });
    },
    delete(url, config2) {
      return this.request(url, { ...config2, method: "DELETE" });
    },
    patch(url, data, config2) {
      return this.request(url, { ...config2, method: "PATCH", body: JSON.stringify(data) });
    }
  };
  return client;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HttpError,
  computed,
  createHttpClient,
  createState,
  defineModel,
  enableDevTools,
  getPromiseState,
  handlePromise,
  isPromise,
  scheduleUpdate,
  subscribe,
  unwrapPromise,
  useStore
});
