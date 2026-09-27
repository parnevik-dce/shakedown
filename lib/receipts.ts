import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Bucket enforces 5MB and jpeg/png/heic/webp; we always convert to a compressed jpeg. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.7;
const SIGNED_URL_TTL_SECONDS = 3600;

async function compress(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION } }], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

/** Opens the camera. Returns a compressed local file uri, or null if cancelled. */
export async function takeReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is off for Shakedown. Enable it in Settings to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true });
  if (result.canceled || !result.assets[0]) return null;
  return compress(result.assets[0].uri);
}

/** Opens the photo library. Returns a compressed local file uri, or null if cancelled. */
export async function chooseReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo access is off for Shakedown. Enable it in Settings to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
  if (result.canceled || !result.assets[0]) return null;
  return compress(result.assets[0].uri);
}

/**
 * Uploads a local file to receipts/{groupId}/{expenseId}.jpg, overwriting any existing
 * one. Row-level security requires the `expenses` row to already exist and belong to the
 * caller, so save the expense first and upload right after (see lib/expenses.ts).
 */
export async function uploadReceipt(groupId: string, expenseId: string, localUri: string): Promise<string> {
  const path = `${groupId}/${expenseId}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from('receipts').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from('receipts').remove([path]);
  if (error) throw new Error(error.message);
}

/** A private bucket, so viewing needs a short-lived signed URL rather than a public one. */
export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(error?.message ?? 'Could not load the receipt.');
  return data.signedUrl;
}
