/**
 * Connexion Google, au-dessus d'un client Supabase. Le service ne connaît que ce dont l'interface a
 * besoin (identifiant, nom, avatar) : rien d'autre n'est gardé du compte Google.
 */

/** Ce que le site retient d'un utilisateur connecté. */
export interface AccountUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthService {
  /** Utilisateur connecté, ou null. Connu après `ready()`. */
  current(): AccountUser | null;
  /** Résolu quand la session enregistrée (ou le retour de Google) a été lue. */
  ready(): Promise<AccountUser | null>;
  /** Appelé à chaque connexion ou déconnexion (pas à chaque renouvellement de jeton). */
  onChange(listener: (user: AccountUser | null) => void): () => void;
  /** Ouvre la page de connexion Google (la page est quittée puis rechargée au retour). */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Supprime le compte et toutes ses parties (définitif), puis termine la session. Échoue sans
   * rien supprimer si la base refuse.
   */
  deleteAccount(): Promise<void>;
}

/** La partie du client Supabase utilisée ici (permet de la remplacer dans les tests). */
export interface AuthClientLike {
  auth: {
    getSession(): Promise<{ data: { session: { user: SupabaseUserLike } | null } }>;
    onAuthStateChange(
      callback: (event: string, session: { user: SupabaseUserLike } | null) => void,
    ): {
      data: { subscription: { unsubscribe(): void } };
    };
    signInWithOAuth(options: {
      provider: 'google';
      options?: { redirectTo?: string };
    }): Promise<{ error: { message: string } | null }>;
    signOut(options?: {
      scope: 'local' | 'global';
    }): Promise<{ error: { message: string } | null }>;
  };
  rpc(fn: 'delete_my_account'): PromiseLike<{ error: { message: string } | null }>;
}

export interface SupabaseUserLike {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function httpsUrl(value: string): string | null {
  try {
    return value && new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** Nom et avatar d'après les métadonnées du compte Google ; l'avatar doit être une adresse https. */
export function toAccountUser(user: SupabaseUserLike | null | undefined): AccountUser | null {
  if (!user || typeof user.id !== 'string' || !user.id) return null;
  const meta = user.user_metadata ?? {};
  const name = text(meta['full_name']) || text(meta['name']) || '';
  const avatar = text(meta['avatar_url']) || text(meta['picture']);
  return { id: user.id, name, avatarUrl: httpsUrl(avatar) };
}

const same = (a: AccountUser | null, b: AccountUser | null): boolean =>
  a === b ||
  (a !== null && b !== null && a.id === b.id && a.name === b.name && a.avatarUrl === b.avatarUrl);

export function createAuthService(client: AuthClientLike, redirectTo: () => string): AuthService {
  let current: AccountUser | null = null;
  const listeners = new Set<(user: AccountUser | null) => void>();

  const update = (user: AccountUser | null): void => {
    if (same(current, user)) return;
    current = user;
    for (const listener of listeners) listener(user);
  };

  // Supabase signale aussi les renouvellements de jeton et le retour sur l'onglet : `update` ne
  // prévient l'interface que si l'utilisateur change vraiment.
  client.auth.onAuthStateChange((_event, session) => update(toAccountUser(session?.user)));

  const ready = client.auth
    .getSession()
    .then(({ data }) => {
      update(toAccountUser(data.session?.user));
      return current;
    })
    .catch(() => current);

  return {
    current: () => current,
    ready: () => ready,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: async () => {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo() },
      });
      if (error) throw new Error(error.message);
    },
    signOut: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
      update(null);
    },
    deleteAccount: async () => {
      const { error } = await client.rpc('delete_my_account');
      if (error) throw new Error(error.message);
      // Le compte n'existe plus : on ne prévient pas le serveur, on oublie seulement la session locale.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      update(null);
    },
  };
}
