import { env } from 'cloudflare:workers';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { captcha, twoFactor } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import { Resend } from 'resend';
import { PasswordReset } from '@/components/email/PasswordReset';
import * as authSchema from '@/db/auth-schema';

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
	}),
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
					from: 'AWT Dashboard <auth@contact.cobaltweb.tech>',
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
				from: 'AWT Dashboard <auth@contact.cobaltweb.tech>',
				to: user.email,
				subject: 'Verify Your Email',
				html: `<p>Click the link below to verify your email address:</p><p><a href="${url}">Verify Email</a></p>`,
			});
		},
	},
	plugins: [
		passkey(),
		twoFactor({
			otpOptions: {
				async sendOTP({ user, otp }: { user: { email: string }; otp: string }) {
					console.log(`Sending OTP to ${user.email}: ${otp}`);
					await resend.emails.send({
						from: 'AWT Dashboard <no-reply@demo.better-auth.com>',
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
