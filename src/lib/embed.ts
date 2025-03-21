/**
 * Generates an iframe embed code for a Bunny.net video
 * @param videoId The ID of the video
 * @param title The title of the video (for accessibility)
 * @param width The width of the iframe (default: 640)
 * @param height The height of the iframe (default: 360)
 * @returns The HTML iframe code as a string
 */
export function generateEmbedCode(
  videoId: string,
  title: string,
  width: number = 640,
  height: number = 360,
): string {
  const libraryId = import.meta.env.PUBLIC_BUNNY_LIBRARY_ID;

  // Base embed URL (without token - we'll get that from the server)
  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

  // Generate the iframe HTML
  return `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}" 
  title="${title.replace(/"/g, "&quot;")}" 
  frameborder="0" 
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen>
</iframe>`;
}

/**
 * Generates a secure embed code with token authentication
 * @param videoId The ID of the video
 * @param title The title of the video
 * @param secureUrl The secure URL with token authentication
 * @param width The width of the iframe (default: 640)
 * @param height The height of the iframe (default: 360)
 * @returns The HTML iframe code as a string
 */
export function generateSecureEmbedCode(
  videoId: string,
  title: string,
  secureUrl: string,
  width: number = 640,
  height: number = 360,
): string {
  // Generate the iframe HTML with the secure URL
  return `<iframe 
  src="${secureUrl}" 
  width="${width}" 
  height="${height}" 
  title="${title.replace(/"/g, "&quot;")}" 
  frameborder="0" 
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen>
</iframe>`;
}
