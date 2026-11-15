import { describe, expect, it, vi } from 'vitest';
import {
  type AuthClientLike,
  type SupabaseUserLike,
  createAuthService,
  toAccountUser,
} from '../src/backend/auth';
import { readConfig } from '../src/backend/config';
import { connectBackend } from '../src/backend';
import { escapeHtml } from '../src/ui/html';

describe('configuration du backend', () => {
  it('est absente sans URL ou sans clé : le site reste en mode v1', () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: 'https://a.supabase.co' })).toBeNull();
    expect(readConfig({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });

  it("lit l'URL (origine seule) et la clé", () => {
    expect(
      readConfig({
        VITE_SUPABASE_URL: ' https://abc.supabase.co/ ',
        VITE_SUPABASE_ANON_KEY: ' k ',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', anonKey: 'k' });
  });

  it('refuse une URL invalide ou en http hors machine locale', () => {
    expect(
      readConfig({ VITE_SUPABASE_URL: 'pas une url', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBeNull();
    expect(
      readConfig({ VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBeNull();
    expect(
      readConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'k',
    });
  });

  it("n'appelle rien sans configuration", async () => {
    expect(await connectBackend({})).toBeNull();
  });
});

describe('utilisateur du compte', () => {
  it("prend le nom et l'avatar des métadonnées Google", () => {
    expect(
      toAccountUser({
        id: 'u1',
        user_metadata: {
          full_name: ' Ada Lovelace ',
          avatar_url: 'https://lh3.googleusercontent.com/a',
        },
      }),
    ).toEqual({ id: 'u1', name: 'Ada Lovelace', avatarUrl: 'https://lh3.googleusercontent.com/a' });
    expect(
      toAccountUser({ id: 'u2', user_metadata: { name: 'Bob', picture: 'https://x.test/p.png' } }),
    ).toEqual({
      id: 'u2',
      name: 'Bob',
      avatarUrl: 'https://x.test/p.png',
    });
  });

  it("écarte un avatar qui n'est pas en https", () => {
    for (const avatar of [
      'http://x.test/p.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAA',
      'pas une url',
    ]) {
      expect(
        toAccountUser({ id: 'u', user_metadata: { avatar_url: avatar } })?.avatarUrl,
      ).toBeNull();
    }
  });

  it('tolère des métadonnées absentes ou de mauvais type', () => {
    expect(toAccountUser({ id: 'u' })).toEqual({ id: 'u', name: '', avatarUrl: null });
    expect(toAccountUser({ id: 'u', user_metadata: { full_name: 42 } })?.name).toBe('');
    expect(toAccountUser(null)).toBeNull();
    expect(toAccountUser({ id: '' })).toBeNull();
  });

  it('échappe le HTML du nom', () => {
    expect(escapeHtml(`<img src=x onerror="a()"> & 'b'`)).toBe(
      '&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;',
    );
  });
});

/** Faux client Supabase : on pilote la session et les événements à la main. */
function fakeClient(initial: SupabaseUserLike | null) {
  type Callback = (event: string, session: { user: SupabaseUserLike } | null) => void;
  let callback: Callback = () => undefined;
  const calls = { signIn: [] as unknown[], signOut: 0 };
  let session = initial ? { user: initial } : null;
  const client: AuthClientLike = {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (cb) => {
        callback = cb;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signInWithOAuth: (options) => {
        calls.signIn.push(options);
        return Promise.resolve({ error: null });
      },
      signOut: () => {
        calls.signOut++;
        session = null;
        return Promise.resolve({ error: null });
      },
    },
  };
  return {
    client,
    calls,
    emit: (event: string, user: SupabaseUserLike | null) => callback(event, user && { user }),
  };
}

const ada: SupabaseUserLike = { id: 'u1', user_metadata: { full_name: 'Ada' } };

describe('service de connexion', () => {
  it('retrouve la session enregistrée au chargement', async () => {
    const { client } = fakeClient(ada);
    const auth = createAuthService(client, () => 'https://site.test/');
    expect(auth.current()).toBeNull();
    expect(await auth.ready()).toEqual({ id: 'u1', name: 'Ada', avatarUrl: null });
    expect(auth.current()?.id).toBe('u1');
  });

  it('reste déconnecté sans session', async () => {
    const { client } = fakeClient(null);
    const auth = createAuthService(client, () => 'https://site.test/');
    expect(await auth.ready()).toBeNull();
  });

  it('prévient quand on se connecte et se déconnecte, pas à chaque renouvellement de jeton', async () => {
    const { client, emit } = fakeClient(null);
    const auth = createAuthService(client, () => 'https://site.test/');
    await auth.ready();
    const listener = vi.fn();
    auth.onChange(listener);
    emit('SIGNED_IN', ada);
    emit('TOKEN_REFRESHED', ada);
    emit('SIGNED_IN', { ...ada });
    expect(listener).toHaveBeenCalledTimes(1);
    emit('SIGNED_OUT', null);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('se désabonne', async () => {
    const { client, emit } = fakeClient(null);
    const auth = createAuthService(client, () => 'https://site.test/');
    const listener = vi.fn();
    auth.onChange(listener)();
    emit('SIGNED_IN', ada);
    expect(listener).not.toHaveBeenCalled();
  });

  it("demande Google avec l'adresse de retour", async () => {
    const { client, calls } = fakeClient(null);
    const auth = createAuthService(client, () => 'https://site.test/Orapa-training/');
    await auth.signIn();
    expect(calls.signIn).toEqual([
      { provider: 'google', options: { redirectTo: 'https://site.test/Orapa-training/' } },
    ]);
  });

  it('se déconnecte', async () => {
    const { client, calls } = fakeClient(ada);
    const auth = createAuthService(client, () => 'x');
    await auth.ready();
    await auth.signOut();
    expect(calls.signOut).toBe(1);
    expect(auth.current()).toBeNull();
  });

  it('signale une erreur de Google', async () => {
    const { client } = fakeClient(null);
    client.auth.signInWithOAuth = () => Promise.resolve({ error: { message: 'refusé' } });
    const auth = createAuthService(client, () => 'x');
    await expect(auth.signIn()).rejects.toThrow('refusé');
  });

  it('une lecture de session qui échoue laisse déconnecté', async () => {
    const { client } = fakeClient(null);
    client.auth.getSession = () => Promise.reject(new Error('réseau'));
    const auth = createAuthService(client, () => 'x');
    expect(await auth.ready()).toBeNull();
  });
});
