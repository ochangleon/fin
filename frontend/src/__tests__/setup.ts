import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement scrollTo
Element.prototype.scrollTo = () => {};

// jsdom doesn't implement ResizeObserver (used by lightweight-charts)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error global polyfill for tests
globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver;
