/** Sensitive profile keys — must match SBCC PROFILE_FIELDS.sensitive */
export const SENSITIVE_KEYS = new Set([
  'phone', 'ein', 'address', 'city', 'state', 'zip',
  'owner_name', 'birth_date', 'birth_place', 'owner_ethnicity',
]);

export function redactContext(context, fullAccess, extraSensitive = []) {
  if (!context || fullAccess) return context;
  const sensitive = new Set([...SENSITIVE_KEYS, ...extraSensitive]);
  const out = JSON.parse(JSON.stringify(context));

  if (out.profile && typeof out.profile === 'object') {
    for (const key of Object.keys(out.profile)) {
      if (sensitive.has(key)) out.profile[key] = '[REDACTED — enable Full Access in AI Settings]';
    }
  }
  return out;
}

export function stripSensitiveFromActions(actions, fullAccess) {
  if (fullAccess || !Array.isArray(actions)) return actions;
  return actions.filter((a) => {
    if (a.tool === 'fill_profile' && SENSITIVE_KEYS.has(a.key)) return false;
    return true;
  });
}
