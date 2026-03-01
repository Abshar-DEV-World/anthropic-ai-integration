import { beforeAll } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

beforeAll(() => {
  // Polyfill TextEncoder/TextDecoder for Node environment
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder as any;
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder as any;
  }
});
