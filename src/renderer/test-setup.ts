// test-setup.ts
import { Window } from 'happy-dom';

// Setup happy-dom for testing
const window = new Window();
global.document = window.document as any;
global.window = window as any;
global.navigator = window.navigator as any;
global.HTMLElement = window.HTMLElement as any;
