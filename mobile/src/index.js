import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from '../app.json';

// Registrar la aplicación
AppRegistry.registerComponent(appName, () => App);

// Cargar en el navegador si estamos en la web
if (typeof document !== 'undefined') {
  const rootTag = document.getElementById('root');
  AppRegistry.runApplication(appName, { rootTag });
} 