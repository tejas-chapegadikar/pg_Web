/** Listing photo rules, shared by the listing form and the Photos window */
export const MAX_NEW_PHOTOS = 10; // server accepts up to 10 per upload
export const MAX_PHOTO_MB = 20; // before shrinking; uploads end up a few hundred KB (lib/compressImage)
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const isAllowedPhoto = (file: File) =>
  PHOTO_TYPES.includes(file.type) && file.size <= MAX_PHOTO_MB * 1024 * 1024;
