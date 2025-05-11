import type { R2Bucket } from "@cloudflare/workers-types";

// Ensure the global type is available for local dev or wrangler
declare global {
  var AIRWARTRAIL_ASSETS: R2Bucket | undefined;
}

const getR2Bucket = (runtimeEnv?: Env): R2Bucket => {
  if (runtimeEnv?.AIRWARTRAIL_ASSETS) {
    return runtimeEnv.AIRWARTRAIL_ASSETS as unknown as R2Bucket;
  }
  if (typeof globalThis.AIRWARTRAIL_ASSETS !== "undefined") {
    return globalThis.AIRWARTRAIL_ASSETS as R2Bucket;
  }
  throw new Error(
    "R2 binding 'AIRWARTRAIL_ASSETS' not found. " +
      "Ensure the binding is configured in wrangler.toml and passed via context.locals.runtime.env in Astro API routes, " +
      "or available globally if not using Astro's platformProxy.",
  );
};

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
