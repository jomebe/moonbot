import { isRecord } from './guards.js';

export interface ValueMatch<T> {
  value: T;
  path: string;
}

export const getValueAtPath = (payload: unknown, path: string): unknown => {
  if (!path) return undefined;

  const keys = path.split('.');
  let cursor: unknown = payload;

  for (const key of keys) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[key];
  }

  return cursor;
};

export const findFirstByPaths = <T>(
  payload: unknown,
  paths: readonly string[],
  predicate: (value: unknown) => value is T
): ValueMatch<T> | undefined => {
  for (const path of paths) {
    const value = getValueAtPath(payload, path);
    if (predicate(value)) {
      return { value, path };
    }
  }
  return undefined;
};

const normalizeKey = (key: string): string => key.replace(/[_-]/g, '').toLowerCase();

export const findFirstByKeyCandidates = <T>(
  payload: unknown,
  keyCandidates: readonly string[],
  predicate: (value: unknown) => value is T,
  maxDepth: number = 6
): ValueMatch<T> | undefined => {
  const candidates = new Set(keyCandidates.map(normalizeKey));
  const seen = new WeakSet<object>();

  type StackItem = {
    node: unknown;
    path: string;
    depth: number;
  };

  const stack: StackItem[] = [{ node: payload, path: '', depth: 0 }];

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    const { node, path, depth } = item;

    if (depth > maxDepth) continue;

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i -= 1) {
        const nextPath = `${path}[${i}]`;
        stack.push({ node: node[i], path: nextPath, depth: depth + 1 });
      }
      continue;
    }

    if (!isRecord(node)) continue;
    if (seen.has(node)) continue;
    seen.add(node);

    for (const [key, value] of Object.entries(node)) {
      const nextPath = path ? `${path}.${key}` : key;

      if (candidates.has(normalizeKey(key)) && predicate(value)) {
        return { value, path: nextPath };
      }

      if (value !== null && typeof value === 'object') {
        stack.push({ node: value, path: nextPath, depth: depth + 1 });
      }
    }
  }

  return undefined;
};
