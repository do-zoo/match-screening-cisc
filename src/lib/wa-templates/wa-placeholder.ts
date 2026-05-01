/** Placeholder tokens in club-editable bodies: `{token_name_snake_case}`. */
export const WA_PLACEHOLDER_TOKEN = /\{([a-z][a-z0-9_]*)\}/g;

/**
 * Substitute `{token}` with string values from `vars`. Leaves no stray `{` / `}`
 * unmatched (guards typo tokens).
 */
export function applyWaPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  const out = template.replace(WA_PLACEHOLDER_TOKEN, (_full, name: string) => {
    if (!(name in vars)) {
      throw new Error(`Nilai hilang untuk placeholder {${name}}`);
    }
    return vars[name]!;
  });
  if (out.includes("{") || out.includes("}")) {
    throw new Error(
      "Template berisi kurung `{}` tidak dikenali — periksa penulisan placeholder",
    );
  }
  return out;
}
