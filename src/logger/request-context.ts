import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  reqId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** The current request's context, or `undefined` outside a request. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Runs `fn` with `context` visible to `getRequestContext()`. */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}
