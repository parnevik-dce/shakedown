import { choosePhoto, getImageUrl, removeImage, takePhoto, uploadImage } from './images';

const BUCKET = 'receipts';

export async function takeReceiptPhoto(): Promise<string | null> {
  return takePhoto('Camera access is off for Shakedown. Enable it in Settings to take a photo.');
}

export async function chooseReceiptPhoto(): Promise<string | null> {
  return choosePhoto('Photo access is off for Shakedown. Enable it in Settings to choose an image.');
}

/**
 * Uploads a local file to receipts/{groupId}/{expenseId}.jpg, overwriting any existing
 * one. Row-level security requires the `expenses` row to already exist and belong to the
 * caller, so save the expense first and upload right after (see lib/expenses.ts).
 */
export async function uploadReceipt(groupId: string, expenseId: string, localUri: string): Promise<string> {
  const path = `${groupId}/${expenseId}.jpg`;
  await uploadImage(BUCKET, path, localUri);
  return path;
}

export async function removeReceipt(path: string): Promise<void> {
  await removeImage(BUCKET, path);
}

export async function getReceiptUrl(path: string): Promise<string> {
  return getImageUrl(BUCKET, path);
}
