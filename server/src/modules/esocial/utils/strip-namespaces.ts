const normalizeKey = (key: string) => {
  const keyWithoutNamespace = key.includes(':') ? key.split(':').pop() ?? key : key;
  return keyWithoutNamespace;
};

export const stripNamespaces = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripNamespaces(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    normalized[normalizeKey(key)] = stripNamespaces(item);
  }

  return normalized;
};
