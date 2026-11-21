import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.squadrant.app',
  appName: 'Squadrant',
  webDir: 'build',
  android: {
    backgroundColor: '#020c04',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#020c04',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
