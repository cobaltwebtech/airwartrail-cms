import { env } from 'cloudflare:workers';
import { apiKey } from '@better-auth/api-key';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { captcha, twoFactor } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import { Resend } from 'resend';
import { PasswordReset } from '@/components/email/PasswordReset';
import * as authSchema from '@/db/auth-schema';
import { API_KEY_LENGTH, generateApiKey } from '@/lib/api-key-generate';

// Initialize Drizzle with the Cloudflare D1 database
export const createDrizzle = (db: D1Database) =>
	drizzle(db, { schema: authSchema });

// Initialize Resend for email service
const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(createDrizzle(env.DB_AUTH), {
		provider: 'sqlite',
		schema: authSchema,
	}),
	experimental: {
		joins: true,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // Session expires in 7 days
		updateAge: 60 * 60 * 24, // Every 24 hours the session expiration is updated
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // Cache session data for 5 minutes
		},
	},
	rateLimit: {
		enabled: true,
	},
	advanced: {
		ipAddress: {
			// Cloudflare specific header for rate limiting
			ipAddressHeaders: ['cf-connecting-ip'],
		},
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			try {
				await resend.emails.send({
					from: 'AWT Dashboard <auth@notify.airwartrail.com>',
					to: user.email,
					subject: 'Password Reset',
					react: await PasswordReset({
						url: url,
					}),
				});
			} catch (error) {
				console.error('Error sending password reset:', error);
				throw error;
			}
		},
	},
	user: {
		changeEmail: {
			enabled: true,
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			void resend.emails.send({
				from: 'AWT Dashboard <auth@notify.airwartrail.com>',
				to: user.email,
				subject: 'Verify Your Email',
				html: `<p>Click the link below to verify your email address:</p><p><a href="${url}">Verify Email</a></p>`,
			});
		},
	},
	plugins: [
		apiKey({
			// Enable API key to create mock sessions for the user
			enableSessionForAPIKeys: true,
			// Custom API key header (default is x-api-key)
			apiKeyHeaders: ['x-api-key'],
			// Default prefix for generated API keys
			defaultPrefix: 'awt_',
			// Custom key generator using nanoid
			customKeyGenerator: generateApiKey,
			// Set the default key length since we're using a custom generator
			defaultKeyLength: API_KEY_LENGTH,
			// Store more starting characters for easier identification (includes prefix)
			startingCharactersConfig: {
				shouldStore: true,
				charactersLength: 8,
			},
			// Rate limiting configuration
			rateLimit: {
				enabled: true,
				timeWindow: 1000 * 60, // 1 minute
				maxRequests: 1000,
			},
			// Default permissions for new API keys
			permissions: {
				defaultPermissions: {
					mux: ['read'], // Default to read-only access
				},
			},
			// Enable metadata storage
			enableMetadata: true,
		}),
		passkey(),
		twoFactor({
			otpOptions: {
				async sendOTP({ user, otp }: { user: { email: string }; otp: string }) {
					console.log(`Sending OTP to ${user.email}: ${otp}`);
					await resend.emails.send({
						from: 'AWT Dashboard <auth@notify.airwartrail.com>',
						to: user.email,
						subject: 'Your OTP',
						html: `Your OTP is ${otp}`,
					});
				},
			},
		}),
		captcha({
			provider: 'cloudflare-turnstile',
			secretKey: env.TURNSTILE_SECRET_KEY,
			endpoints: [
				'/sign-up/email',
				'/sign-in/email',
				'/request-password-reset',
			],
		}),
	],
});
