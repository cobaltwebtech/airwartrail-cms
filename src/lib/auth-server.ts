import { betterAuth } from "better-auth";
import { passkey } from "better-auth/plugins/passkey";
import { twoFactor } from "better-auth/plugins";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { createClient } from "@libsql/client";

// Create a new Turso database connection
const client = createClient({
  url: import.meta.env.TURSO_DB_URL,
  authToken: import.meta.env.TURSO_DB_TOKEN,
});

// Create Kysely instance with Turso dialect
const dialect = new LibsqlDialect({ client });

export const auth = betterAuth({
  secret: import.meta.env.BETTER_AUTH_SECRET,
  database: {
    dialect,
    type: "sqlite",
  },
  session: {
    expiresIn: 60 * 60 * 24, // Session expires in 1 day
    updateAge: 60 * 60, // Every 1 hour the session expiration is updated
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    passkey(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }: { user: { email: string }; otp: string }) {
          console.log(`Sending OTP to ${user.email}: ${otp}`);
          // await resend.emails.send({
          // 	from: "Acme <no-reply@demo.better-auth.com>",
          // 	to: user.email,
          // 	subject: "Your OTP",
          // 	html: `Your OTP is ${otp}`,
          // });
        },
      },
    }),
  ],
  rateLimit: {
    enabled: true,
  },
});
