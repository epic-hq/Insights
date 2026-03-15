export function asQueryClient<T>(client: T): any {
  return client as any;
}

export function asRow<T>(value: unknown): T | null {
  return value == null ? null : (value as T);
}

export function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
