import type { R2Bucket } from "@cloudflare/workers-types";

declare global {
  var AIRWARTRAIL_ASSETS: R2Bucket | undefined;
}

// For local development with mock data
const mockFiles = [
  {
    key: "sample-image.jpg",
    size: 12345,
    uploaded: new Date().toISOString(),
    etag: "mock-etag",
    httpEtag: 'W/"mock-etag"',
    version: "mock-version",
  },
  {
    key: "sample-document.pdf",
    size: 54321,
    uploaded: new Date().toISOString(),
    etag: "mock-etag-2",
    httpEtag: 'W/"mock-etag-2"',
    version: "mock-version",
  },
];

// Create a development mock implementation
const mockR2Bucket = {
  get: async (key) => {
    console.log("Mock R2: Fetching", key);
    const mockFile = mockFiles.find((file) => file.key === key);
    if (!mockFile) return null;

    return {
      key: mockFile.key,
      size: mockFile.size,
      etag: mockFile.etag,
      httpEtag: mockFile.httpEtag,
      version: mockFile.version,
      body: new ReadableStream(),
      httpMetadata: {
        contentType: key.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
      },
    };
  },
  put: async (key, value) => {
    console.log("Mock R2: Saving", key);
    const newFile = {
      key,
      size: value instanceof ArrayBuffer ? value.byteLength : 1000,
      uploaded: new Date().toISOString(),
      etag: `mock-etag-${Date.now()}`,
      httpEtag: `W/"mock-etag-${Date.now()}"`,
      version: "mock-version",
    };
    mockFiles.push(newFile);
    return newFile;
  },
  delete: async (key) => {
    console.log("Mock R2: Deleting", key);
    const index = mockFiles.findIndex((file) => file.key === key);
    if (index !== -1) {
      mockFiles.splice(index, 1);
    }
  },
  list: async () => {
    console.log("Mock R2: Listing files");
    return {
      objects: mockFiles,
      truncated: false,
      cursor: "",
      delimitedPrefixes: [],
    };
  },
};

// Late binding check function - will be called each time we access R2
// It now accepts the platform environment object from Astro's context.
// The 'Env' type is globally available from worker-configuration.d.ts
const getR2Bucket = (runtimeEnv?: Env) => {
  // Priority 1: Use binding from the passed runtimeEnv (context.platform.env)
  if (runtimeEnv?.AIRWARTRAIL_ASSETS) {
    return runtimeEnv.AIRWARTRAIL_ASSETS;
  }
  // Priority 2: Use global binding (e.g., for `wrangler dev` directly, or if platformProxy is disabled)
  if (typeof globalThis.AIRWARTRAIL_ASSETS !== "undefined") {
    return globalThis.AIRWARTRAIL_ASSETS;
  }

  // Fallback to mock if no binding is found
  console.warn(
    "R2 binding 'AIRWARTRAIL_ASSETS' not found. Falling back to mock R2 bucket. " +
      "Ensure the binding is configured in wrangler.toml and passed via context.platform.env in Astro API routes, " +
      "or available globally if not using Astro's platformProxy.",
  );
  return mockR2Bucket as unknown as R2Bucket;
};

// Export functions that check for the binding at call time
// These functions now expect the Astro/Cloudflare runtime environment as the first argument.
export const R2BucketAWT = {
  get: async (runtimeEnv: Env, ...args: Parameters<R2Bucket["get"]>) =>
    getR2Bucket(runtimeEnv).get(...args),
  put: async (runtimeEnv: Env, ...args: Parameters<R2Bucket["put"]>) =>
    getR2Bucket(runtimeEnv).put(...args),
  delete: async (runtimeEnv: Env, ...args: Parameters<R2Bucket["delete"]>) =>
    getR2Bucket(runtimeEnv).delete(...args),
  list: async (runtimeEnv: Env, ...args: Parameters<R2Bucket["list"]>) =>
    getR2Bucket(runtimeEnv).list(...args),
};
