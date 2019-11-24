import { Connection } from '../../src/lib/types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeConnectedWith(connection: Connection): R;
    }
  }
}

export {};
