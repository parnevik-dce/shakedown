import { choosePhoto, getImageUrl, removeImage, takePhoto, uploadImage } from './images';

const BUCKET = 'receipts';

export async function takeReceiptPhoto(): Promise<string | null> {
  const picked = await takePhoto('Camera access is off for Shakedown. Enable it in Settings to take a photo.');
  return picked?.uri ?? null;
}

export async function chooseReceiptPhoto(): Promise<string | null> {
  const picked = await choosePhoto('Photo access is off for Shakedown. Enable it in Settings to choose an image.');
  return picked?.uri ?? null;
}

/**
 * Uploads a local file to receipts/{groupId}/{expenseId}.jpg, overwriting any existing
 * one. Row-level security requires the `expenses` row to already exist and belong to the
 * caller, so save the expense first and upload right after (see lib/expenses.ts). Always
 * a flattened jpeg -- receipts don't support animated GIFs.
 */
export async function uploadReceipt(groupId: string, expenseId: string, localUri: string): Promise<string> {
  const path = `${groupId}/${expenseId}.jpg`;
  await uploadImage(BUCKET, path, { uri: localUri, isGif: false });
  return path;
}

export async function removeReceipt(path: string): Promise<void> {
  await removeImage(BUCKET, path);
}

export async function getReceiptUrl(path: string): Promise<string> {
  return getImageUrl(BUCKET, path);
}
