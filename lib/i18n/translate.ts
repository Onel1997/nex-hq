type Vars = Record<string, string | number>;

function resolvePath(
  dictionary: Record<string, unknown>,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars[name] ?? `{${name}}`),
  );
}

export function createTranslator(dictionary: Record<string, unknown>) {
  return function t(key: string, vars?: Vars): string {
    const value = resolvePath(dictionary, key);
    if (value === undefined) return key;
    return interpolate(value, vars);
  };
}

export type TFunction = ReturnType<typeof createTranslator>;
