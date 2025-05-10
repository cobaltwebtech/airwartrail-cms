import type { R2Bucket } from '@cloudflare/workers-types';

// Make sure this EXACTLY matches the binding name in wrangler.toml
declare global {
  // The binding name must match exactly: "airwartrail_assets"
  var airwartrail_assets: R2Bucket;
}

// For local development with mock data
const mockFiles = [
  {
    key: 'sample-image.jpg',
    size: 12345,
    uploaded: new Date().toISOString(),
    etag: 'mock-etag',
    httpEtag: 'W/"mock-etag"',
    version: 'mock-version'
  },
  {
    key: 'sample-document.pdf',
    size: 54321,
    uploaded: new Date().toISOString(),
    etag: 'mock-etag-2',
    httpEtag: 'W/"mock-etag-2"',
    version: 'mock-version'
  }
];

// Create a development mock implementation
const mockR2Bucket = {
  get: async (key) => {
    console.log('Mock R2: Fetching', key);
    const mockFile = mockFiles.find(file => file.key === key);
    if (!mockFile) return null;
    
    return {
      key: mockFile.key,
      size: mockFile.size,
      etag: mockFile.etag,
      httpEtag: mockFile.httpEtag,
      version: mockFile.version,
      body: new ReadableStream(),
      httpMetadata: { 
        contentType: key.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf' 
      }
    };
  },
  put: async (key, value) => {
    console.log('Mock R2: Saving', key);
    const newFile = {
      key,
      size: value instanceof ArrayBuffer ? value.byteLength : 1000,
      uploaded: new Date().toISOString(),
      etag: `mock-etag-${Date.now()}`,
      httpEtag: `W/"mock-etag-${Date.now()}"`,
      version: 'mock-version'
    };
    mockFiles.push(newFile);
    return newFile;
  },
  delete: async (key) => {
    console.log('Mock R2: Deleting', key);
    const index = mockFiles.findIndex(file => file.key === key);
    if (index !== -1) {
      mockFiles.splice(index, 1);
    }
  },
  list: async () => {
    console.log('Mock R2: Listing files');
    return {
      objects: mockFiles,
      truncated: false,
      cursor: '',
      delimitedPrefixes: []
    };
  }
};

// Late binding check function - will be called each time we access R2
const getR2Bucket = () => {
  // Check for binding at runtime, not module initialization time
  return typeof airwartrail_assets !== 'undefined' ? airwartrail_assets : mockR2Bucket as unknown as R2Bucket;
};

// Export functions that check for the binding at call time
export const R2BucketAWT = {
  get: async (...args: Parameters<R2Bucket['get']>) => getR2Bucket().get(...args),
  put: async (...args: Parameters<R2Bucket['put']>) => getR2Bucket().put(...args),
  delete: async (...args: Parameters<R2Bucket['delete']>) => getR2Bucket().delete(...args),
  list: async (...args: Parameters<R2Bucket['list']>) => getR2Bucket().list(...args),
} as R2Bucket;