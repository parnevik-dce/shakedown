import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Shared image pick/compress/upload helpers, used by receipts and trip covers.
 * Buckets enforce 5MB and jpeg/png/heic/webp (trip-covers also allows gif); we
 * convert everything else to a compressed jpeg. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL_SECONDS = 3600;

export type PickedImage = { uri: string; isGif: boolean };

function isGifAsset(asset: ImagePicker.ImagePickerAsset): boolean {
  if (asset.mimeType) return asset.mimeType === 'image/gif';
  return /\.gif(\?|$)/i.test(asset.fileName ?? asset.uri);
}

async function compress(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION } }], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * A GIF is left exactly as picked, since running it through the image manipulator
 * would flatten it to a single static frame. Everything else gets compressed.
 */
async function process(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  if (isGifAsset(asset)) return { uri: asset.uri, isGif: true };
  return { uri: await compress(asset.uri), isGif: false };
}

/** Opens the camera. Camera capture is never a GIF. Returns null if cancelled. */
export async function takePhoto(deniedMessage: string): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error(deniedMessage);
  const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true });
  if (result.canceled || !result.assets[0]) return null;
  return process(result.assets[0]);
}

/**
 * Opens the photo library. Returns null if cancelled. `allowGif` disables the
 * crop UI (which would flatten an animated GIF) when the caller wants to keep
 * a picked GIF animated -- pass true for a cover photo, leave false for
 * anything that should always end up a flattened photo (e.g. a receipt).
 */
export async function choosePhoto(deniedMessage: string, allowGif = false): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(deniedMessage);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: !allowGif,
  });
  if (result.canceled || !result.assets[0]) return null;
  return process(result.assets[0]);
}

/** Uploads a local file to `bucket`/`path`, overwriting any existing object there. */
export async function uploadImage(bucket: string, path: string, image: PickedImage): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(image.uri, { encoding: 'base64' });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const contentType = image.isGif ? 'image/gif' : 'image/jpeg';
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function removeImage(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}

/** Private buckets, so viewing needs a short-lived signed URL rather than a public one. */
export async function getImageUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(error?.message ?? 'Could not load the image.');
  return data.signedUrl;
}
