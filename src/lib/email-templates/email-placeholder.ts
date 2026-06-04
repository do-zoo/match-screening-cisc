/** Placeholder tokens in club-editable email bodies: `{token_name_snake_case}`. */
export const EMAIL_PLACEHOLDER_TOKEN = /\{([a-z][a-z0-9_]*)\}/g

export function applyEmailPlaceholders(template: string, vars: Record<string, string>): string {
  const out = template.replace(EMAIL_PLACEHOLDER_TOKEN, (_full, name: string) => {
    if (!(name in vars)) {
      throw new Error(`Nilai hilang untuk placeholder {${name}}`)
    }
    return vars[name]!
  })
  if (out.includes('{') || out.includes('}')) {
    throw new Error('Template berisi kurung `{}` tidak dikenali — periksa penulisan placeholder')
  }
  return out
}
