const user = { id: 'u1', name: 'Ashok Verma', email: 'owner@colortimes.in', role: 'super_admin' as const };
export const useAuth = () => ({
  status: 'signedIn', user, onboarded: true, signOut: async () => undefined, signIn: async () => undefined, register: async () => undefined,
  unlock: async () => false, unlockWithPin: async () => ({ ok: false, attemptsLeft: 4 }), mpinOffer: false, dismissMpinOffer: () => undefined,
  replaceTokens: async () => undefined, refreshUser: async () => undefined,
});
export const useRole = () => user.role;
export function AuthProvider({ children }: { children: React.ReactNode }) { return children; }
