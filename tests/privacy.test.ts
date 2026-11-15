import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { privacyPage } from '../src/ui/privacy';

describe('page de confidentialité', () => {
  it('sans backend : rien ne quitte le navigateur, aucune suppression proposée', () => {
    const html = privacyPage({ backend: false, signedIn: false, deletion: 'idle' }, '2.0.0');
    expect(html).toContain('rien ne quitte votre navigateur');
    expect(html).not.toContain('data-action');
    expect(html).not.toContain('Supabase');
  });

  it("avec un compte : dit ce qui est gardé et ce qui ne l'est jamais", () => {
    const html = privacyPage({ backend: true, signedIn: true, deletion: 'idle' }, '2.0.0');
    expect(html).toContain('Supabase');
    expect(html).toContain('Jamais : la mine cachée');
    expect(html).toContain('data-action="ask-delete-account"');
  });

  it('demande une confirmation avant de supprimer', () => {
    const idle = privacyPage({ backend: true, signedIn: true, deletion: 'idle' }, 'v');
    expect(idle).not.toContain('confirm-delete-account');
    const confirm = privacyPage({ backend: true, signedIn: true, deletion: 'confirm' }, 'v');
    expect(confirm).toContain('data-action="confirm-delete-account"');
    expect(confirm).toContain('data-action="cancel-delete-account"');
  });

  it('gère la suppression en cours et son échec', () => {
    expect(privacyPage({ backend: true, signedIn: true, deletion: 'busy' }, 'v')).toContain(
      'Suppression…',
    );
    const failed = privacyPage({ backend: true, signedIn: true, deletion: 'error' }, 'v');
    expect(failed).toContain('Suppression impossible');
    expect(failed).toContain('data-action="ask-delete-account"');
  });

  it('ne propose pas la suppression à un visiteur non connecté', () => {
    const html = privacyPage({ backend: true, signedIn: false, deletion: 'idle' }, 'v');
    expect(html).not.toContain('delete-account');
  });
});

/** Fichiers du dépôt qui finissent dans le navigateur ou dans git : aucun secret n'y a sa place. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('secrets', () => {
  const published = [...files('src'), '.env.example', 'index.html', 'vite.config.ts'];

  it('aucune clé de service ni secret Supabase dans le code du site', () => {
    for (const path of published) {
      const text = readFileSync(path, 'utf-8');
      expect(text, path).not.toMatch(/service_role/i);
      expect(text, path).not.toMatch(/sb_secret_/);
      // Un jeton JWT (clé anon ou service) collé dans le code : trois segments base64 commençant par eyJ.
      expect(text, path).not.toMatch(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/);
    }
  });

  it('seules les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont lues', () => {
    const used = new Set<string>();
    for (const path of published) {
      for (const match of readFileSync(path, 'utf-8').matchAll(/VITE_[A-Z_]+/g)) used.add(match[0]);
    }
    expect([...used].sort()).toEqual(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
  });

  it('les fichiers .env ne sont pas suivis par git', () => {
    const ignore = readFileSync('.gitignore', 'utf-8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
  });
});
