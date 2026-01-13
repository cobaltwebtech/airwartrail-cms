import { auth } from "@/lib/auth-server";

// Define the session type - matches Better Auth session structure
type Session = {
	user: {
		id: string;
		email: string;
		name: string;
		createdAt: Date;
		updatedAt: Date;
	};
	session: {
		id: string;
		userId: string;
		expiresAt: Date;
	};
} | null;

// Define the user type (non-null version for protected routes)
type User = NonNullable<Session>["user"];

// Authentication type - how the user authenticated
export type AuthType = 'session' | 'api-key' | null;

// API Key info when authenticated via API key
export type ApiKeyInfo = {
	id: string;
	name: string | null;
	permissions: Record<string, string[]> | null;
	metadata: Record<string, unknown> | null;
} | null;

export type Context = {
	req: Request;
	env: Env;
	workerCtx: ExecutionContext;
	// Session can be null for unauthenticated requests
	session: Session | null;
	// Request headers for any additional auth needs
	headers: Headers;
	// How the user authenticated (session cookies or API key)
	authType: AuthType;
	// API key info when authenticated via API key
	apiKey: ApiKeyInfo;
};

// Extended context type for protected routes where user is guaranteed
export type ProtectedContext = Context & {
	session: NonNullable<Session>;
	user: User;
};

// Extended context type for API key authenticated routes
export type ApiKeyContext = ProtectedContext & {
	authType: 'api-key';
	apiKey: NonNullable<ApiKeyInfo>;
};

export async function createContext({
	req,
	env,
	workerCtx,
}: {
	req: Request;
	env: Env;
	workerCtx: ExecutionContext;
}): Promise<Context> {
	// Retrieve session from Better Auth using request cookies or API key
	let session: Session | null = null;
	let authType: AuthType = null;
	let apiKeyInfo: ApiKeyInfo = null;

	// Check if request has an API key header
	const apiKeyHeader = req.headers.get('x-api-key');

	try {
		// Better Auth's getSession will automatically handle API key authentication
		// when enableSessionForAPIKeys is enabled in the apiKey plugin
		const authSession = await auth.api.getSession({
			headers: req.headers,
		});

		if (authSession?.user && authSession?.session) {
			session = {
				user: {
					id: authSession.user.id,
					email: authSession.user.email,
					name: authSession.user.name,
					createdAt: authSession.user.createdAt,
					updatedAt: authSession.user.updatedAt,
				},
				session: {
					id: authSession.session.id,
					userId: authSession.session.userId,
					expiresAt: authSession.session.expiresAt,
				},
			};

			// Determine auth type based on whether API key was used
			if (apiKeyHeader) {
				authType = 'api-key';
				// Verify the API key to get additional info
				try {
					const verifyResult = await auth.api.verifyApiKey({
						body: { key: apiKeyHeader },
					});
					if (verifyResult.valid && verifyResult.key) {
						// Handle permissions - may be string or object
						let permissions: Record<string, string[]> | null = null;
						if (verifyResult.key.permissions) {
							permissions = typeof verifyResult.key.permissions === 'string'
								? JSON.parse(verifyResult.key.permissions)
								: verifyResult.key.permissions;
						}

						// Handle metadata - may be string or object
						let metadata: Record<string, unknown> | null = null;
						if (verifyResult.key.metadata) {
							metadata = typeof verifyResult.key.metadata === 'string'
								? JSON.parse(verifyResult.key.metadata)
								: verifyResult.key.metadata;
						}

						apiKeyInfo = {
							id: verifyResult.key.id,
							name: verifyResult.key.name ?? null,
							permissions,
							metadata,
						};
					}
				} catch {
					// API key verification failed, but session was created
					console.warn("API key verification failed after session creation");
				}
			} else {
				authType = 'session';
			}
		}
	} catch (error) {
		// Session retrieval failed - user is not authenticated
		console.error("Error retrieving session:", error);
	}

	return {
		req,
		env,
		workerCtx,
		session,
		headers: req.headers,
		authType,
		apiKey: apiKeyInfo,
	};
}
