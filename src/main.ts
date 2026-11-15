import './style.css';
import { connectBackend } from './backend';
import { startApp } from './ui/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Élément #app introuvable');
}

const app = startApp(root, __APP_VERSION__);

// Le jeu démarre tout de suite ; la connexion Google est branchée dès que le backend est prêt
// (et seulement si le site est configuré : voir docs/backend.md).
void connectBackend().then((backend) => {
  if (backend) app.attachBackend(backend);
});
