import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
  userEmail?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getUserId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.userId;
}

export function getUserEmail(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.userEmail;
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function setUserId(userId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userId = userId;
  }
}

export function runWithContext<T>(callback: () => Promise<T>): Promise<T> {
  return asyncLocalStorage.run({}, callback);
}

export function runWithUserId<T>(userId: string, callback: () => Promise<T>): Promise<T> {
  return asyncLocalStorage.run({ userId }, callback);
}

export function createRequestContextMiddleware() {
  return (req: any, res: any, next: any) => {
    const userId = req.user?._id?.toString();
    const userEmail = req.user?.email;
    asyncLocalStorage.run({ userId, userEmail }, () => {
      next();
    });
  };
}