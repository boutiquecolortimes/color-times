const user = { id: 'u1', name: 'Ashok Verma', email: 'owner@colortimes.in', role: 'super_admin' as const };
export const useAuth = () => ({
  status: 'signedIn', user, onboarded: true, signOut: async () => undefined,
  replaceTokens: async () => undefined, refreshUser: async () => undefined,
});
export const useRole = () => user.role;
export function AuthProvider({ children }: { children: React.ReactNode }) { return children; }
