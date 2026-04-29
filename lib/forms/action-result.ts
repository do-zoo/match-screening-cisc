export type FieldErrors = Record<string, string>;

export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = { ok: false; fieldErrors?: FieldErrors; rootError?: string };

export type ActionResult<T> = ActionOk<T> | ActionErr;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function fieldError(fieldErrors: FieldErrors, rootError?: string): ActionErr {
  return { ok: false, fieldErrors, rootError };
}

export function rootError(rootError: string): ActionErr {
  return { ok: false, rootError };
}
