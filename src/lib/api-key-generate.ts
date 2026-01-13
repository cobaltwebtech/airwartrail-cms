import { customAlphabet } from 'nanoid';

/**
 * Custom alphabet for API key generation
 * Uses alphanumeric characters (0-9, A-Z, a-z) for URL-safe keys
 */
const API_KEY_ALPHABET =
	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Length of the generated API key (excluding prefix)
 */
export const API_KEY_LENGTH = 84;

/**
 * Create the nanoid generator with custom alphabet
 */
const generateId = customAlphabet(API_KEY_ALPHABET, API_KEY_LENGTH);

/**
 * Custom API key generator for Better Auth
 * Generates a secure API key using nanoid with alphanumeric characters
 *
 * @param options - Options from Better Auth containing length and prefix
 * @returns The generated API key with optional prefix
 */
export function generateApiKey(options: {
	length: number;
	prefix: string | undefined;
}): string {
	const key = generateId();

	// If a prefix is provided, prepend it to the key
	if (options.prefix) {
		return `${options.prefix}${key}`;
	}

	return key;
}
