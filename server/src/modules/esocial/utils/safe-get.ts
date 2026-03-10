const resolvePathValues = (input: unknown, path: string): unknown[] => {
  const segments = path.split('.').filter(Boolean);
  let current: unknown[] = [input];

  for (const segment of segments) {
    const next: unknown[] = [];

    for (const item of current) {
      if (item === null || item === undefined) continue;

      if (Array.isArray(item)) {
        for (const arrayItem of item) {
          if (arrayItem && typeof arrayItem === 'object' && segment in (arrayItem as Record<string, unknown>)) {
            next.push((arrayItem as Record<string, unknown>)[segment]);
          }
        }
        continue;
      }

      if (typeof item === 'object' && segment in (item as Record<string, unknown>)) {
        next.push((item as Record<string, unknown>)[segment]);
      }
    }

    current = next;
    if (current.length === 0) {
      return [];
    }
  }

  return current;
};

export const safeGet = <T = unknown>(input: unknown, paths: string[]): T | undefined => {
  for (const path of paths) {
    const values = resolvePathValues(input, path);
    const candidate = values.find((value) => value !== null && value !== undefined && value !== '');
    if (candidate !== undefined) {
      return candidate as T;
    }
  }

  return undefined;
};

export const safeGetAll = <T = unknown>(input: unknown, paths: string[]): T[] => {
  const items: T[] = [];
  for (const path of paths) {
    const values = resolvePathValues(input, path)
      .filter((value) => value !== null && value !== undefined) as T[];
    items.push(...values);
  }
  return items;
};
