import { choosePhoto, getImageUrl, removeImage, takePhoto, uploadImage, type PickedImage } from './images';

const BUCKET = 'trip-covers';

export async function takeCoverPhoto(): Promise<PickedImage | null> {
  return takePhoto('Camera access is off for Shakedown. Enable it in Settings to take a photo.');
}

/** allowGif: keep an animated GIF picked from the library animated, instead of flattening it. */
export async function chooseCoverPhoto(): Promise<PickedImage | null> {
  return choosePhoto('Photo access is off for Shakedown. Enable it in Settings to choose an image.', true);
}

/**
 * One cover per trip, always overwritten. The extension follows the file: an animated
 * GIF is stored (and served) as .gif so it keeps playing; anything else is a .jpg.
 */
export async function uploadTripCover(groupId: string, image: PickedImage): Promise<string> {
  const path = `${groupId}/cover.${image.isGif ? 'gif' : 'jpg'}`;
  await uploadImage(BUCKET, path, image);
  return path;
}

export async function removeTripCover(path: string): Promise<void> {
  await removeImage(BUCKET, path);
}

export async function getTripCoverUrl(path: string): Promise<string> {
  return getImageUrl(BUCKET, path);
}
