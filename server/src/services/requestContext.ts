import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
  userEmail?: string;
  requestPath?: string;
  creditUsed?: number;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Fallback storage for when async context is lost (e.g., in SDK callbacks)
let currentUserId: string | undefined = undefined;
let currentUserEmail: string | undefined = undefined;
let currentRequestPath: string | undefined = undefined;
let currentCreditUsed: number | undefined = undefined;

export function getUserId(): string | undefined {
  // First try async local storage
  const store = asyncLocalStorage.getStore();
  if (store?.userId) return store.userId;

  // Fallback to module-level variable
  return currentUserId;
}

export function getUserEmail(): string | undefined {
  // First try async local storage
  const store = asyncLocalStorage.getStore();
  if (store?.userEmail) return store.userEmail;

  // Fallback to module-level variable
  return currentUserEmail;
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function setUserId(userId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userId = userId;
  }
  // Also set fallback
  currentUserId = userId;
}

export function setUserEmail(email: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userEmail = email;
  }
  // Also set fallback
  currentUserEmail = email;
}

export function setRequestPath(path: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.requestPath = path;
  }
  // Also set fallback
  currentRequestPath = path;
}

export function getRequestPath(): string | undefined {
  // First try async local storage
  const store = asyncLocalStorage.getStore();
  if (store?.requestPath) return store.requestPath;

  // Fallback to module-level variable
  return currentRequestPath;
}

export function setCreditUsed(creditUsed: number): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.creditUsed = creditUsed;
  }
  currentCreditUsed = creditUsed;
}

export function getCreditUsed(): number | undefined {
  const store = asyncLocalStorage.getStore();
  if (typeof store?.creditUsed === 'number') return store.creditUsed;
  return currentCreditUsed;
}

export function clearFallbackContext(): void {
  currentUserId = undefined;
  currentUserEmail = undefined;
  currentRequestPath = undefined;
  currentCreditUsed = undefined;
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

    // Set fallback context for SDK callbacks
    currentUserId = userId;
    currentUserEmail = userEmail;

    asyncLocalStorage.run({ userId, userEmail }, () => {
      next();

      // Clear fallback after response finishes
      res.on('finish', () => {
        currentUserId = undefined;
        currentUserEmail = undefined;
      });
    });
  };
}