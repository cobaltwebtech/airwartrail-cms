import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

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
	baseURL: import.meta.env.BETTER_AUTH_URL,
	plugins: [
		passkeyClient(),
		twoFactorClient({
			onTwoFactorRedirect: () => {
				window.location.href = '/two-factor';
			},
		}),
	],
});
