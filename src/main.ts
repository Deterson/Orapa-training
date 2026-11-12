import './style.css';
import { renderHome } from './ui/home';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Élément #app introuvable');
}

renderHome(root, { version: __APP_VERSION__ });
