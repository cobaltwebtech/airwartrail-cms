import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
	baseURL: import.meta.env.BETTER_AUTH_URL,
	plugins: [passkeyClient(), twoFactorClient()],
});

export const {
	signIn,
	signOut,
	useSession,
	revokeSessions,
	signUp,
	$Infer,
	updateUser,
	requestPasswordReset,
	resetPassword,
	sendVerificationEmail,
	changeEmail,
} = authClient;
