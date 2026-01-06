import { customAlphabet } from "nanoid";

// ============================================================================
// ID Generation using nanoid
// ============================================================================

// Mux Library ID
export const generateLibraryId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	8,
);

// Individual Video ID
export const generateVideoId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  24,
);
