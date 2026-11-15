/**
 * Page « Confidentialité » : ce que le site garde, où, et comment l'effacer. Les textes sont courts
 * mais exacts : ils décrivent ce que fait le code (voir docs/backend.md).
 */
import { t } from './strings';

export interface PrivacyModel {
  /** Le site est-il relié à un backend (sinon : aucune donnée ne sort du navigateur) ? */
  backend: boolean;
  signedIn: boolean;
  /** Étape de la suppression du compte. */
  deletion: 'idle' | 'confirm' | 'busy' | 'error';
}

function deletion(model: PrivacyModel): string {
  if (!model.signedIn) return '';
  const p = t.privacy;
  switch (model.deletion) {
    case 'confirm':
      return `<div class="confirm" role="alertdialog" aria-label="${p.confirmLabel}"><p>${p.confirm}</p>
        <div class="actions"><button type="button" class="danger" data-action="confirm-delete-account">${p.deleteConfirm}</button><button type="button" class="ghost" data-action="cancel-delete-account">${t.modal.cancel}</button></div></div>`;
    case 'busy':
      return `<p class="placeholder" role="status">${p.deleting}</p>`;
    case 'error':
      return `<p class="warning" role="alert">${p.deleteFailed}</p>
        <p><button type="button" class="ghost" data-action="ask-delete-account">${p.delete}</button></p>`;
    default:
      return `<p><button type="button" class="ghost danger" data-action="ask-delete-account">${p.delete}</button></p>`;
  }
}

export function privacyPage(model: PrivacyModel, version: string): string {
  const back = `<p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>`;
  const stored = `<h2>Dans votre navigateur</h2>
    <ul class="rule-list">
      <li>La partie en cours, pour la reprendre.</li>
      <li>Les parties terminées pas encore envoyées, si vous êtes connecté.</li>
      <li>Votre session de connexion, si vous êtes connecté.</li>
    </ul>
    <p>Rien d'autre : pas de suivi, pas de publicité.</p>`;
  const remote = model.backend
    ? `<h2>Avec un compte Google</h2>
    <p>La connexion passe par Google ; le site n'utilise que le <b>nom</b> et l'<b>avatar</b>.
    Le compte (identifiant, nom, avatar, adresse e-mail) et les parties sont gardés chez
    <b>Supabase</b>, qui héberge la base.</p>
    <ul class="rule-list">
      <li>Par partie terminée : graine, repères tirés, proposition, résultat, durée, dates.</li>
      <li>Jamais : la mine cachée, vos notes et vos dessins.</li>
      <li>Vos parties ne sont lisibles que par vous.</li>
      <li>Sans compte, rien n'est envoyé : le jeu est identique.</li>
    </ul>
    <h2>Vos droits</h2>
    <ul class="rule-list">
      <li>Consulter : <a href="#historique">${t.history.link}</a> et <a href="#profil">${t.profile.link}</a>.</li>
      <li>Se déconnecter : la session locale est effacée.</li>
      <li>Supprimer : le compte et <b>toutes ses parties</b> sont effacés, tout de suite et sans retour.</li>
    </ul>
    ${deletion(model)}`
    : `<h2>Sur ce site</h2>
    <p>Aucun compte, aucun serveur : <b>rien ne quitte votre navigateur</b>.</p>`;
  return `<article class="rules privacy">
    <h1>${t.privacy.title}</h1>
    ${remote}
    ${stored}
    <p class="hint">Le site est hébergé par GitHub Pages.</p>
    ${back}
    <p class="hint">v${version}</p>
  </article>`;
}
