import { choosePhoto, getImageUrl, removeImage, takePhoto, uploadImage } from './images';

const BUCKET = 'trip-covers';

export async function takeCoverPhoto(): Promise<string | null> {
  return takePhoto('Camera access is off for Shakedown. Enable it in Settings to take a photo.');
}

export async function chooseCoverPhoto(): Promise<string | null> {
  return choosePhoto('Photo access is off for Shakedown. Enable it in Settings to choose an image.');
}

/** One cover per trip, always overwritten (unlike receipts, there's no per-item id to key on). */
export async function uploadTripCover(groupId: string, localUri: string): Promise<string> {
  const path = `${groupId}/cover.jpg`;
  await uploadImage(BUCKET, path, localUri);
  return path;
}

export async function removeTripCover(path: string): Promise<void> {
  await removeImage(BUCKET, path);
}

export async function getTripCoverUrl(path: string): Promise<string> {
  return getImageUrl(BUCKET, path);
}
