/**
 * Routeur par adresse (hash) : accueil, partie, règles, historique, profil, confidentialité.
 * Les anciennes adresses (`#regles`, `#historique`, `#profil`, `#confidentialite`, `#jeu`) restent
 * comprises : des liens déjà partagés continuent de marcher.
 */
export type View = 'home' | 'game' | 'rules' | 'history' | 'profile' | 'privacy';

const ROUTES: Record<View, string> = {
  home: '#/',
  game: '#/partie',
  rules: '#/regles',
  history: '#/historique',
  profile: '#/profil',
  privacy: '#/confidentialite',
};

/** La page demandée par une adresse ; l'accueil par défaut. */
export function parseRoute(hash: string): View {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  switch (path) {
    case 'partie':
    case 'jeu':
      return 'game';
    case 'regles':
      return 'rules';
    case 'historique':
      return 'history';
    case 'profil':
      return 'profile';
    case 'confidentialite':
      return 'privacy';
    default:
      return 'home';
  }
}

/** L'adresse d'une page, à mettre dans un lien. */
export function routeHash(view: View): string {
  return ROUTES[view];
}
