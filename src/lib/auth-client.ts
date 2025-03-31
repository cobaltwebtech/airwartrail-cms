import { createAuthClient } from "better-auth/react";
import { passkeyClient, twoFactorClient } from "better-auth/client/plugins";

export const {
  signIn,
  signOut,
  useSession,
  signUp,
  passkey: passkeyActions,
  useListPasskeys,
  twoFactor: twoFactorActions,
  $Infer,
  updateUser,
  changePassword,
  revokeSession,
  revokeSessions,
} = createAuthClient({
  baseURL: "http://localhost:4321",
  plugins: [
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/two-factor";
      },
    }),
  ],
  // Add this to ensure proper redirection
  redirects: {
    afterSignIn: "/dashboard",
    afterSignUp: "/dashboard",
    afterSignOut: "/login",
  },
});
