
export class ImageProcessingService {
  /**
   * Processes an image for storage. Strictly uses WebP for optimal compression.
   */
  static async processToWebP(base64Str: string): Promise<string> {
    // If it's already an optimized webp string from a previous pass, skip
    if (base64Str.startsWith('data:image/webp') && base64Str.length < 1200000) {
      return base64Str;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        try {
          // Optimized dimensions for faster storage while maintaining quality
          const MAX_DIM = 1536; 
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d', { 
            alpha: false, // Opaque for faster rendering
            desynchronized: true
          });
          
          if (!ctx) {
            resolve(base64Str);
            return;
          }
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Strictly use webp format
          const optimizedData = canvas.toDataURL('image/webp', 0.85);
          resolve(optimizedData);
          
        } catch (err) {
          console.warn("Image optimization failed, falling back to original.", err);
          resolve(base64Str);
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      };
      
      img.onerror = () => {
        resolve(base64Str);
      };
      
      img.src = base64Str;
    });
  }

  /**
   * Calculates approximate Base64 string size in MB.
   */
  static getBase64SizeMB(base64Str: string): number {
    const stringLength = base64Str.length - (base64Str.indexOf(',') + 1);
    const sizeInBytes = (stringLength * 3) / 4;
    return sizeInBytes / (1024 * 1024);
  }
}
