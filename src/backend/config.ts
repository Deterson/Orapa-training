/**
 * Configuration du backend (Supabase). Sans URL ni clé publique, le site fonctionne comme en v1 :
 * aucun bouton de connexion, aucun appel réseau. Voir docs/backend.md.
 */
export interface BackendConfig {
  url: string;
  anonKey: string;
}

/** Lit la configuration dans les variables `VITE_*` ; null si elle est absente ou invalide. */
export function readConfig(env: Record<string, unknown>): BackendConfig | null {
  const url = typeof env['VITE_SUPABASE_URL'] === 'string' ? env['VITE_SUPABASE_URL'].trim() : '';
  const anonKey =
    typeof env['VITE_SUPABASE_ANON_KEY'] === 'string' ? env['VITE_SUPABASE_ANON_KEY'].trim() : '';
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    // En production, uniquement du HTTPS ; http reste permis pour un Supabase local.
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null;
    return { url: parsed.origin, anonKey };
  } catch {
    return null;
  }
}
