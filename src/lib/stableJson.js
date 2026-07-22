function toStableValue(value) {
  if (Array.isArray(value)) {
    return value.map(toStableValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, toStableValue(value[key])]),
    );
  }

  return value;
}

export function stableJson(value) {
  return JSON.stringify(toStableValue(value));
}
