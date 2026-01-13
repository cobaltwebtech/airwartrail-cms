import { z } from 'zod';

// Password schema with validation rules
export const passwordSchema = z.object({
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(100, 'Password must be less than 100 characters')
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
			'Password must contain at least one uppercase letter, one lowercase letter, and one number',
		),
});

// Email schema
export const emailSchema = z.object({
	email: z.email('Please enter a valid email address'),
});

// Login schema
export const passwordLoginSchema = z.object({
	email: z.email('Please enter a valid email address'),
	password: z.string().min(1, 'Password is required'),
});

// Signup schema
export const signupSchema = z.object({
	firstName: z
		.string()
		.min(2, { message: 'First name must be at least 2 characters' })
		.max(50, { message: 'First name must be less than 50 characters' }),
	lastName: z
		.string()
		.min(2, { message: 'Last name must be at least 2 characters' })
		.max(50, { message: 'Last name must be less than 50 characters' }),
	email: z.email({ message: 'Please enter a valid email address' }),
	password: z
		.string()
		.min(8, { message: 'Password must be at least 8 characters' })
		.regex(/[a-z]/, {
			message: 'Password must contain at least one lowercase letter',
		})
		.regex(/[A-Z]/, {
			message: 'Password must contain at least one uppercase letter',
		})
		.regex(/[0-9]/, { message: 'Password must contain at least one number' }),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

// Password reset schema
export const resetPasswordSchema = z
	.object({
		password: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(100, 'Password must be less than 100 characters')
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				'Password must contain at least one uppercase letter, one lowercase letter, and one number',
			),
		confirmPassword: z.string(),
		token: z.string().min(1, 'Reset token is required'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

// Forgot password schema
export const forgotPasswordSchema = emailSchema;

// Change password schema (for authenticated users)
export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(100, 'Password must be less than 100 characters')
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				'Password must contain at least one uppercase letter, one lowercase letter, and one number',
			),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
	.refine((data) => data.currentPassword !== data.newPassword, {
		message: 'New password must be different from current password',
		path: ['newPassword'],
	});

// Playlist schema
export const playlistSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.max(100, 'Name must be less than 100 characters'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(100, 'Slug must be less than 100 characters')
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'Slug must be lowercase letters, numbers, and hyphens only',
		),
	description: z
		.string()
		.max(1000, 'Description must be less than 1000 characters')
		.optional(),
	tags: z
		.array(z.string().max(50, 'Tag must be less than 50 characters'))
		.max(20, 'Maximum of 20 tags allowed')
		.optional(),
});

export type PlaylistFormValues = z.infer<typeof playlistSchema>;
