import '@testing-library/jest-dom/vitest'
beforeEach(() => { localStorage.clear(); window.confirm = () => true; window.scrollTo = vi.fn() as unknown as typeof window.scrollTo })
afterEach(() => { vi.unstubAllGlobals() })
