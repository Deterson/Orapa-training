import './style.css';
import { startApp } from './ui/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Élément #app introuvable');
}

startApp(root, __APP_VERSION__);
