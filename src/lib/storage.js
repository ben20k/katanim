import { supabase } from './supabase';

const MAX_BYTES = 5 * 1024 * 1024;

export function validateUpload(file, { allowPdf = false } = {}) {
  if (!file) return 'Please choose a file.';
  const okType = file.type.startsWith('image/') || (allowPdf && file.type === 'application/pdf');
  if (!okType) return allowPdf ? 'Upload an image (JPG/PNG) or a PDF.' : 'Upload an image (JPG/PNG/WebP).';
  if (file.size > MAX_BYTES) return 'File is larger than 5 MB.';
  return '';
}

const ext = (file) => (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');

// Public asset (product photo, QR code) → returns public URL
export async function uploadPublicAsset(folder, file) {
  const path = `${folder}/${crypto.randomUUID()}.${ext(file)}`;
  const { error } = await supabase.storage.from('public-assets').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('public-assets').getPublicUrl(path).data.publicUrl;
}

// Private proof of payment → returns storage path
export async function uploadProof(userId, orderId, paymentId, file) {
  const path = `${userId}/${orderId}/${paymentId}-${Date.now()}.${ext(file)}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function signedProofUrl(path) {
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}
