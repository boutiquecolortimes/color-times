/**
 * @format
 */
import { AppRegistry } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Background/quit-state pushes are displayed by the OS (they carry a
// `notification` payload); this handler only has to exist so Android
// doesn't warn. Skipped when Firebase isn't configured.
try {
  if (getApps().length > 0) {
    setBackgroundMessageHandler(getMessaging(), async () => {});
  }
} catch {
  // Firebase not configured — push disabled.
}

AppRegistry.registerComponent(appName, () => App);
