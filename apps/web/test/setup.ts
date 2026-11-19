import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

class EventSourceStub {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
globalThis.EventSource = EventSourceStub as unknown as typeof EventSource;
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

// Node's experimental Web Storage removes the global and jsdom's window storage
// on some runtimes (CI Node 20/24, local Node 26). Provide a real Storage
// implementation so components that use bare localStorage work everywhere
// without a runtime flag, and reset it between tests.
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

const local = globalThis.localStorage ?? window.localStorage ?? createMemoryStorage();
const session = globalThis.sessionStorage ?? window.sessionStorage ?? createMemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: session, configurable: true });

afterEach(() => {
  local.clear();
  session.clear();
});
