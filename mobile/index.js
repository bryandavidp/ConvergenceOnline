/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// Registrar la aplicación para React Native
AppRegistry.registerComponent(appName, () => App);

// Registrar la aplicación para React Native Web
if (window) {
  AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root')
  });
} 