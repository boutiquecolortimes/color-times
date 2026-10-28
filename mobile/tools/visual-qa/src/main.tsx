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
    login: async () => ({ C: (await import('@app/screens/auth/LoginScreen')).LoginScreen }),
    register: async () => ({ C: (await import('@app/screens/auth/RegisterScreen')).RegisterScreen }),
    forgot: async () => ({ C: (await import('@app/screens/auth/ForgotPasswordScreen')).ForgotPasswordScreen, params: { email: 'owner@colortimesboutique.com' } }),
    products: async () => ({ C: (await import('@app/screens/admin/products/ProductScreens')).ProductsScreen }),
    invoices: async () => ({ C: (await import('@app/screens/admin/billing/InvoiceScreens')).InvoicesScreen }),
    customisation: async () => ({ C: (await import('@app/screens/admin/orders/OrderScreens')).CustomisationScreen }),
    customisationForm: async () => ({ C: (await import('@app/screens/admin/orders/OrderScreens')).CustomisationFormScreen }),
    invoiceForm: async () => ({ C: (await import('@app/screens/admin/billing/InvoiceScreens')).InvoiceFormScreen }),
    expenses: async () => ({ C: (await import('@app/screens/admin/people/PeopleScreens')).ExpensesScreen }),
    more: async () => ({ C: (await import('@app/screens/admin/misc/MiscScreens')).MoreScreen }),
    explore: async () => ({ C: (await import('@app/screens/customer/CustomerScreens')).ExploreScreen }),
    lock: async () => ({ C: (await import('@app/screens/auth/LockScreen')).LockScreen }),
    mpin: async () => {
      const { MpinSetup } = await import('@app/components/MpinSetup');
      return { C: () => <MpinSetup visible mode="create" offer onDone={() => undefined} onCancel={() => undefined} /> };
    },
    splash: async () => {
      const { BrandSplash } = await import('@app/components/brand/BrandSplash');
      return { C: () => <BrandSplash ready={false} /> };
    },
  };
  const { C, params: initialParams } = await screens[screen]();
  // ?tabs=1 draws the screen as a tab, with the real floating TabBar on top (as on the phone).
  const asTab = params.get('tabs') === '1';
  const { InTabsContext } = await import('@app/navigation/tabSpace');
  const { TabBar } = await import('@app/navigation/TabBar');
  const tabRoutes = ['Dashboard', 'BookingsTab', 'Catalogue', 'Billing', 'More'].map((name) => ({ key: name, name }));
  const tabTitles: Record<string, string> = { Dashboard: 'Dashboard', BookingsTab: 'Bookings', Catalogue: 'Products', Billing: 'Invoices', More: 'More' };
  const fakeTabs = {
    state: { index: 1, routes: tabRoutes },
    descriptors: Object.fromEntries(tabRoutes.map((r) => [r.key, { options: { title: tabTitles[r.name] } }])),
    navigation: { emit: () => ({ defaultPrevented: true }), navigate: () => undefined },
  } as never;
  const Stack = createNativeStackNavigator();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(document.getElementById('root')!).render(
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          {() => (
            <>
              <InTabsContext.Provider value={asTab}>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Screen" component={C} initialParams={initialParams} />
                  </Stack.Navigator>
                </NavigationContainer>
              </InTabsContext.Provider>
              {asTab ? <TabBar {...(fakeTabs as object)} /> : null}
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
