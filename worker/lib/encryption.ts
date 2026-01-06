/**
 * Encryption utilities for sensitive data storage
 * Uses AES-256-GCM with Web Crypto API (compatible with Cloudflare Workers)
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Derives a CryptoKey from the encryption secret
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		'PBKDF2',
		false,
		['deriveBits', 'deriveKey'],
	);

	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			// Using a fixed salt is acceptable here since we're using unique IVs per encryption
			// and the secret should already be high-entropy
			salt: encoder.encode('mux-library-credentials-salt'),
			iterations: 100000,
			hash: 'SHA-256',
		},
		keyMaterial,
		{ name: ALGORITHM, length: KEY_LENGTH },
		false,
		['encrypt', 'decrypt'],
	);
}

/**
 * Encrypts a plaintext string
 * Returns base64 encoded string: IV (12 bytes) + ciphertext + auth tag
 */
export async function encrypt(
	plaintext: string,
	encryptionSecret: string,
): Promise<string> {
	if (!plaintext) return '';
	if (!encryptionSecret) {
		throw new Error('Encryption secret is required');
	}

	const encoder = new TextEncoder();
	const key = await deriveKey(encryptionSecret);

	// Generate random IV for each encryption
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv },
		key,
		encoder.encode(plaintext),
	);

	// Combine IV + ciphertext into single array
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);

	// Return as base64 for safe storage
	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a ciphertext string
 * Expects base64 encoded string: IV (12 bytes) + ciphertext + auth tag
 */
export async function decrypt(
	ciphertext: string,
	encryptionSecret: string,
): Promise<string> {
	if (!ciphertext) return '';
	if (!encryptionSecret) {
		throw new Error('Encryption secret is required');
	}

	try {
		const key = await deriveKey(encryptionSecret);

		// Decode from base64
		const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

		// Extract IV and ciphertext
		const iv = combined.slice(0, IV_LENGTH);
		const encryptedData = combined.slice(IV_LENGTH);

		const decrypted = await crypto.subtle.decrypt(
			{ name: ALGORITHM, iv },
			key,
			encryptedData,
		);

		return new TextDecoder().decode(decrypted);
	} catch (error) {
		console.error('Decryption failed:', error);
		throw new Error('Failed to decrypt data. The encryption key may have changed.');
	}
}

/**
 * Encrypts multiple fields in an object
 * Only encrypts string values that are not empty
 */
export async function encryptFields<T extends Record<string, unknown>>(
	data: T,
	fields: (keyof T)[],
	encryptionSecret: string,
): Promise<T> {
	const result = { ...data };

	for (const field of fields) {
		const value = data[field];
		if (typeof value === 'string' && value) {
			(result as Record<string, unknown>)[field as string] = await encrypt(
				value,
				encryptionSecret,
			);
		}
	}

	return result;
}

/**
 * Decrypts multiple fields in an object
 * Only decrypts string values that are not empty
 */
export async function decryptFields<T extends Record<string, unknown>>(
	data: T,
	fields: (keyof T)[],
	encryptionSecret: string,
): Promise<T> {
	const result = { ...data };

	for (const field of fields) {
		const value = data[field];
		if (typeof value === 'string' && value) {
			try {
				(result as Record<string, unknown>)[field as string] = await decrypt(
					value,
					encryptionSecret,
				);
			} catch {
				// If decryption fails, the value might not be encrypted (legacy data)
				// Keep the original value
				console.warn(`Failed to decrypt field ${String(field)}, keeping original value`);
			}
		}
	}

	return result;
}
