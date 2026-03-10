export interface KeyMatch {
  key: string;
  value: unknown;
  path: string;
}

const joinPath = (base: string, key: string) => (base ? `${base}.${key}` : key);

export const findAllByKey = (input: unknown, keyName: string, basePath = ''): KeyMatch[] => {
  const matches: KeyMatch[] = [];

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      matches.push(...findAllByKey(item, keyName, `${basePath}[${index}]`));
    });
    return matches;
  }

  if (!input || typeof input !== 'object') {
    return matches;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const path = joinPath(basePath, key);
    if (key.toLowerCase() === keyName.toLowerCase()) {
      matches.push({ key, value, path });
    }

    matches.push(...findAllByKey(value, keyName, path));
  }

  return matches;
};

export const findFirstStringByKeys = (input: unknown, keys: string[]): string | undefined => {
  const lowered = new Set(keys.map((key) => key.toLowerCase()));

  const stack: unknown[] = [input];
  while (stack.length > 0) {
    const current = stack.pop();

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (!current || typeof current !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (lowered.has(key.toLowerCase()) && value !== null && value !== undefined) {
        const parsed = String(value).trim();
        if (parsed) return parsed;
      }

      if (typeof value === 'object' && value !== null) {
        stack.push(value);
      }
    }
  }

  return undefined;
};
