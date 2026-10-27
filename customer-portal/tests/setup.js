import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// jsdom (the fake browser used in tests) does not implement scrolling,
// so replace window.scrollTo with an empty function.
window.scrollTo = () => {};

// Every test starts with an empty cart and no saved login
beforeEach(() => {
  localStorage.clear();
});
