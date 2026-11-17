import './style.css';
import { connectBackend } from './backend';
import { readConfig } from './backend/config';
import { startApp } from './ui/app';
import { initTheme } from './ui/theme';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Élément #app introuvable');
}

// Le thème choisi s'applique avant le premier affichage (pas de clignotement).
initTheme();

const app = startApp(root, __APP_VERSION__, {
  accountsConfigured: readConfig(import.meta.env) !== null,
});

// Le jeu démarre tout de suite ; la connexion Google est branchée dès que le backend est prêt
// (et seulement si le site est configuré : voir docs/backend.md).
void connectBackend().then((backend) => {
  if (backend) app.attachBackend(backend);
  else app.backendUnavailable();
});
