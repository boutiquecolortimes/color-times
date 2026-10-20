import React from 'react';
import { createRoot } from 'react-dom/client';
import { Appearance } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// RN-web has no app-level override; the provider calls it, so make it inert.
(Appearance as unknown as { setColorScheme: () => void }).setColorScheme = () => undefined;

const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'dashboard';

async function boot() {
  const { ThemeProvider } = await import('@app/theme/ThemeProvider');
  const { ToastHost, DialogHost } = await import('@app/components/ui');
  const screens: Record<string, () => Promise<{ C: React.ComponentType; params?: object }>> = {
    dashboard: async () => ({ C: (await import('@app/screens/admin/DashboardScreen')).DashboardScreen }),
    bookings: async () => ({ C: (await import('@app/screens/admin/bookings/BookingsScreen')).BookingsScreen }),
    booking: async () => ({ C: (await import('@app/screens/admin/bookings/BookingDetailScreen')).BookingDetailScreen, params: { id: 'b1' } }),
    customer: async () => ({ C: (await import('@app/screens/admin/customers/CustomerScreens')).CustomerDetailScreen, params: { id: 'c1' } }),
    home: async () => ({ C: (await import('@app/screens/customer/CustomerScreens')).CustomerHomeScreen }),
    dress: async () => ({ C: (await import('@app/screens/customer/CustomerScreens')).DressScreen, params: { id: 'p2' } }),
    account: async () => ({ C: (await import('@app/screens/shared/AccountScreen')).AccountScreen }),
  };
  const { C, params: initialParams } = await screens[screen]();
  const Stack = createNativeStackNavigator();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(document.getElementById('root')!).render(
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          {() => (
            <>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Screen" component={C} initialParams={initialParams} />
                </Stack.Navigator>
              </NavigationContainer>
              <ToastHost />
              <DialogHost />
            </>
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
boot().catch((e) => {
  document.body.innerHTML = `<pre id="boot-error">${String(e?.stack ?? e)}</pre>`;
});
