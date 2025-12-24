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

export type Context = {
	req: Request;
	env: Env;
	workerCtx: ExecutionContext;
	// Session can be null for unauthenticated requests
	session: Session | null;
	// Request headers for any additional auth needs
	headers: Headers;
};

// Extended context type for protected routes where user is guaranteed
export type ProtectedContext = Context & {
	session: NonNullable<Session>;
	user: User;
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
	// Retrieve session from Better Auth using request cookies
	let session: Session | null = null;

	try {
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
	};
}
