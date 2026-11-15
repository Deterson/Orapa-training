/**
 * Point d'entrée du backend : crée le client Supabase seulement si le site est configuré.
 * La bibliothèque est chargée à la demande, donc un site sans configuration ne la télécharge pas.
 */
import { type AuthService, createAuthService } from './auth';
import { type GamesClientLike, type GamesService, createGamesService } from './games';
import { readConfig } from './config';

export interface Backend {
  auth: AuthService;
  games: GamesService;
}

/** Adresse de retour après Google : la page sans paramètres (la partie est sauvegardée en local). */
const returnUrl = (): string => `${window.location.origin}${window.location.pathname}`;

/** Le backend, ou null si le site n'est pas configuré (mode v1) ou si le chargement échoue. */
export async function connectBackend(
  env: Record<string, unknown> = import.meta.env,
): Promise<Backend | null> {
  const config = readConfig(env);
  if (config === null) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(config.url, config.anonKey, {
      auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
    });
    return {
      auth: createAuthService(client, returnUrl),
      games: createGamesService(client as unknown as GamesClientLike),
    };
  } catch {
    return null;
  }
}
