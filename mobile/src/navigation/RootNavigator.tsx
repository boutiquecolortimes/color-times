import React, { useEffect } from 'react';
import { View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  type NavigationState,
  NavigationContainer,
  createNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { colors, currentScheme, fonts, gradients } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { isAdmin } from '../lib/roles';
import { listenForPush } from '../lib/push';
import { toast } from '../components/ui';
import { BrandSplash } from '../components/brand/BrandSplash';
import { MpinSetup } from '../components/MpinSetup';
import { TabBar } from './TabBar';
import { InTabsContext } from './tabSpace';
import { routeForLink, type AnyParams } from './nav';

import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LockScreen } from '../screens/auth/LockScreen';

import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { BookingsScreen } from '../screens/admin/bookings/BookingsScreen';
import { BookingDetailScreen, UndoReturnScreen } from '../screens/admin/bookings/BookingDetailScreen';
import { BookingFormScreen } from '../screens/admin/bookings/BookingFormScreen';
import {
  CategoriesScreen,
  ProductDetailScreen,
  ProductFormScreen,
  ProductsScreen,
} from '../screens/admin/products/ProductScreens';
import {
  CustomerDetailScreen,
  CustomerFormScreen,
  CustomersScreen,
} from '../screens/admin/customers/CustomerScreens';
import {
  InvoiceDetailScreen,
  InvoiceFormScreen,
  InvoicesScreen,
} from '../screens/admin/billing/InvoiceScreens';
import {
  CustomisationDetailScreen,
  CustomisationFormScreen,
  CustomisationScreen,
  SaleDetailScreen,
  SaleFormScreen,
  SalesScreen,
  ServiceDetailScreen,
  ServiceFormScreen,
  ServicesScreen,
} from '../screens/admin/orders/OrderScreens';
import {
  ExpensesScreen,
  PurchaseFormScreen,
  PurchasesScreen,
  SalaryPaymentsScreen,
  StaffDetailScreen,
  StaffScreen,
  TeamScreen,
} from '../screens/admin/people/PeopleScreens';
import {
  EnquiriesScreen,
  MoreScreen,
  NotificationsScreen,
  ReportsScreen,
  ReviewsScreen,
  SearchScreen,
  SettingsScreen,
  TrashScreen,
} from '../screens/admin/misc/MiscScreens';
import { AccountScreen } from '../screens/shared/AccountScreen';
import {
  ConversationScreen,
  WaCreateTemplateScreen,
  WaInboxScreen,
  WaLogsScreen,
  WaMappingsScreen,
  WaMetaTemplatesScreen,
  WaProfileScreen,
  WaQrScreen,
  WaSendScreen,
  WaSettingsScreen,
  WhatsAppScreen,
} from '../screens/admin/whatsapp/WhatsAppScreens';
import {
  AnalyticsScreen,
  BookingCalendarScreen,
  PurchaseParcelScreen,
} from '../screens/admin/extra/ExtraScreens';
import {
  AddressesScreen,
  CustomerHomeScreen,
  DressScreen,
  ExploreScreen,
  MyBookingScreen,
  MyBookingsScreen,
  WishlistScreen,
} from '../screens/customer/CustomerScreens';
import { PriveScreen } from '../screens/customer/PriveScreen';
import {
  AboutScreen,
  BlogPostScreen,
  BlogScreen,
  CollectionsScreen,
  ContactScreen,
  FaqScreen,
  GalleryScreen,
  InfoHubScreen,
  LegalScreen,
  OffersScreen,
  ReviewScreen,
  TestimonialsScreen,
  TrackOrderScreen,
} from '../screens/customer/InfoScreens';

const Stack = createNativeStackNavigator<AnyParams>();

/** Website info pages — shared by the customer app and the signed-out (guest) stack. */
const infoScreens = () => [
  <Stack.Screen key="InfoHub" name="InfoHub" component={InfoHubScreen} />,
  <Stack.Screen key="About" name="About" component={AboutScreen} />,
  <Stack.Screen key="Offers" name="Offers" component={OffersScreen} />,
  <Stack.Screen key="Testimonials" name="Testimonials" component={TestimonialsScreen} />,
  <Stack.Screen key="Faq" name="Faq" component={FaqScreen} />,
  <Stack.Screen key="Blog" name="Blog" component={BlogScreen} />,
  <Stack.Screen key="BlogPost" name="BlogPost" component={BlogPostScreen} />,
  <Stack.Screen key="Legal" name="Legal" component={LegalScreen} />,
  <Stack.Screen key="Contact" name="Contact" component={ContactScreen} />,
  <Stack.Screen key="TrackOrder" name="TrackOrder" component={TrackOrderScreen} />,
];
const Tabs = createBottomTabNavigator<AnyParams>();

export const navigationRef = createNavigationContainerRef<AnyParams>();

// Built per render so it follows the active scheme.
const navTheme = (): Theme => ({
  ...(currentScheme() === 'dark' ? DarkTheme : DefaultTheme),
  dark: currentScheme() === 'dark',
  colors: {
    ...(currentScheme() === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    primary: colors.gold,
    border: colors.border,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '400' },
    medium: { fontFamily: fonts.bodyMedium, fontWeight: '500' },
    bold: { fontFamily: fonts.bodySemi, fontWeight: '600' },
    heavy: { fontFamily: fonts.bodyBold, fontWeight: '700' },
  },
});

const stackOptions = () => ({
  headerShown: false,
  animation: 'slide_from_right' as const,
  contentStyle: { backgroundColor: colors.bg },
});

// ----------------------------------------------------------------- Admin ---

function AdminTabs() {
  // Tab screens know to keep content and bottom bars clear of the floating tab bar.
  return (
    <InTabsContext.Provider value>
      <Tabs.Navigator
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="BookingsTab" component={BookingsScreen} options={{ title: 'Bookings' }} />
        <Tabs.Screen name="Catalogue" component={ProductsScreen} options={{ title: 'Products' }} />
        <Tabs.Screen name="Billing" component={InvoicesScreen} options={{ title: 'Invoices' }} />
        <Tabs.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
      </Tabs.Navigator>
    </InTabsContext.Provider>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions()}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="Bookings" component={BookingsScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <Stack.Screen
        name="BookingForm"
        component={BookingFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="UndoReturn" component={UndoReturnScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Invoices" component={InvoicesScreen} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <Stack.Screen
        name="InvoiceForm"
        component={InvoiceFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Sales" component={SalesScreen} />
      <Stack.Screen name="SaleDetail" component={SaleDetailScreen} />
      <Stack.Screen name="SaleForm" component={SaleFormScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Customisation" component={CustomisationScreen} />
      <Stack.Screen name="CustomisationDetail" component={CustomisationDetailScreen} />
      <Stack.Screen
        name="CustomisationForm"
        component={CustomisationFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Services" component={ServicesScreen} />
      <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
      <Stack.Screen
        name="ServiceForm"
        component={ServiceFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Team" component={TeamScreen} />
      <Stack.Screen name="Staff" component={StaffScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="SalaryPayments" component={SalaryPaymentsScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="Purchases" component={PurchasesScreen} />
      <Stack.Screen
        name="PurchaseForm"
        component={PurchaseFormScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Enquiries" component={EnquiriesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Trash" component={TrashScreen} />
      <Stack.Screen name="WhatsApp" component={WhatsAppScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="BookingCalendar" component={BookingCalendarScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="WaInbox" component={WaInboxScreen} />
      <Stack.Screen name="WaSend" component={WaSendScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="WaMetaTemplates" component={WaMetaTemplatesScreen} />
      <Stack.Screen
        name="WaCreateTemplate"
        component={WaCreateTemplateScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="WaMappings" component={WaMappingsScreen} />
      <Stack.Screen name="WaSettings" component={WaSettingsScreen} />
      <Stack.Screen name="WaProfile" component={WaProfileScreen} />
      <Stack.Screen name="WaQr" component={WaQrScreen} />
      <Stack.Screen name="WaLogs" component={WaLogsScreen} />
      <Stack.Screen
        name="PurchaseParcel"
        component={PurchaseParcelScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// -------------------------------------------------------------- Customer ---

function CustomerTabs() {
  // Tab screens know to keep content and bottom bars clear of the floating tab bar.
  return (
    <InTabsContext.Provider value>
      <Tabs.Navigator
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="Home" component={CustomerHomeScreen} options={{ title: 'Home' }} />
        <Tabs.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore' }} />
        <Tabs.Screen name="WishlistTab" component={WishlistScreen} options={{ title: 'Wishlist' }} />
        <Tabs.Screen name="MyBookings" component={MyBookingsScreen} options={{ title: 'Bookings' }} />
        <Tabs.Screen name="Profile" component={AccountScreen} options={{ title: 'Profile' }} />
      </Tabs.Navigator>
    </InTabsContext.Provider>
  );
}

function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions()}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
      <Stack.Screen name="Dress" component={DressScreen} />
      <Stack.Screen name="Collection" component={ExploreScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="MyBooking" component={MyBookingScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="Collections" component={CollectionsScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      {infoScreens()}
      <Stack.Screen
        name="Prive"
        component={PriveScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------ Auth ---

function AuthStack({ onboarded }: { onboarded: boolean }) {
  return (
    <Stack.Navigator
      screenOptions={{ ...stackOptions(), animation: 'fade' }}
      initialRouteName={onboarded ? 'Login' : 'Onboarding'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      {infoScreens()}
    </Stack.Navigator>
  );
}

/** Behind the animated splash while the session loads: the launch screen's wine, so nothing flashes. */
function Splash() {
  return <View style={{ flex: 1, backgroundColor: gradients.wine[1] }} />;
}

// Survives the remount a theme switch causes, so the user stays on the same screen.
const navState: { current: NavigationState | undefined } = { current: undefined };

export function RootNavigator() {
  const { scheme } = useTheme();
  const { status, user, onboarded, mpinOffer, dismissMpinOffer } = useAuth();

  // Push: in-app toast while open, deep link when tapped.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const go = (data: Record<string, unknown>) => {
      const target = routeForLink(typeof data.link === 'string' ? data.link : null);
      if (target && navigationRef.isReady()) navigationRef.navigate(target.name, target.params);
    };
    return listenForPush((data, title, body) => toast.info(title ?? 'Color Times', body, () => go(data)), go);
  }, [status]);

  // Theme switches remount the tree (key) — carry the navigation state across.
  // The launch animation sits outside it, so it plays once and never replays on a theme switch.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavigationContainer
        key={scheme}
        ref={navigationRef}
        theme={navTheme()}
        initialState={navState.current}
        onStateChange={(state) => {
          navState.current = state;
        }}
      >
        {status === 'loading' ? (
          <Splash />
        ) : status === 'signedOut' ? (
          <AuthStack onboarded={onboarded} />
        ) : status === 'locked' ? (
          <LockScreen />
        ) : isAdmin(user?.role) ? (
          <AdminStack />
        ) : (
          <CustomerStack />
        )}
      </NavigationContainer>
      {/* One-time offer after a password sign-in: set an MPIN for quick unlock. */}
      <MpinSetup
        visible={mpinOffer && status === 'signedIn'}
        mode="create"
        offer
        onDone={dismissMpinOffer}
        onCancel={dismissMpinOffer}
      />
      <BrandSplash ready={status !== 'loading'} />
    </View>
  );
}
