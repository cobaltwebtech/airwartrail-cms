// Define the session type - matches Better Auth session structure
type Session = {
	user: {
		id: string;
		email: string;
		name: string;
		role?: string;
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
	// TODO: Implement session retrieval from Better Auth
	// For now, return null session - implement auth integration later
	const session: Session | null = null;

	return {
		req,
		env,
		workerCtx,
		session,
		headers: req.headers,
	};
};
