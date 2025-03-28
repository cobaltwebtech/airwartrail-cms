import { betterAuth } from "better-auth";
import { passkey } from "better-auth/plugins/passkey";
import { twoFactor } from "better-auth/plugins";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./db.sqlite"),
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
