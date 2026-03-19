/**
 * Generates an optimized Cloudinary URL with transformations for better performance
 * @param url - Original Cloudinary URL
 * @param transformations - Optional transformation parameters
 * @returns Optimized URL with transformations
 */
export function getOptimizedCloudinaryUrl(
  url: string | null,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  } = {}
): string | null {
  if (!url || !url.includes('cloudinary.com')) return url;

  const {
    width = 400,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
  } = options;

  try {
    // Parse the URL
    const urlParts = url.split('/upload/');
    if (urlParts.length !== 2) return url;

    // Build transformation string
    const transformations: string[] = [];

    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    if (crop) transformations.push(`c_${crop}`);
    if (quality) transformations.push(`q_${quality}`);
    if (format) transformations.push(`f_${format}`);

    // Reconstruct URL with transformations
    return `${urlParts[0]}/upload/${transformations.join(',')}/${urlParts[1]}`;
  } catch {
    return url;
  }
}

/**
 * Get a thumbnail version of a Cloudinary image
 */
export function getThumbnailUrl(url: string | null): string | null {
  return getOptimizedCloudinaryUrl(url, {
    width: 400,
    height: 300,
    crop: 'fill',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Get a full-size optimized version of a Cloudinary image
 */
export function getFullSizeUrl(url: string | null): string | null {
  return getOptimizedCloudinaryUrl(url, {
    width: 1200,
    quality: 'auto',
    format: 'auto',
  });
}
