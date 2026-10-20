/**
 * Color Times — premium boutique app (iOS + Android).
 * One app for every role: customers get the boutique; staff, admins,
 * developers and super admins get the full ERP with web-identical permissions.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/api/queryClient';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DialogHost, ToastHost } from './src/components/ui';
import { ThemeProvider } from './src/theme/ThemeProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {(scheme) => (
            <AuthProvider>
              <RootNavigator />
              {/* Keyed so their (module-styled) UI re-reads tokens on a theme switch. */}
              <ToastHost key={`toast-${scheme}`} />
              <DialogHost key={`dialog-${scheme}`} />
            </AuthProvider>
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
