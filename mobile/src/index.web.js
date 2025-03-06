import { AppRegistry } from 'react-native';
import App from './App';

// Registrar la aplicación para React Native Web
AppRegistry.registerComponent('ConvergenceMobile', () => App);

// Iniciar la aplicación en el elemento con id 'root'
AppRegistry.runApplication('ConvergenceMobile', {
  rootTag: document.getElementById('root')
}); 