import { supabase } from '../config/supabase.js';
import { ok, badRequest, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Upload file to Supabase storage
 */
export async function uploadFile(req, res) {
  try {
    const { bucket, path } = req.body;
    const file = req.file; // Assuming multer for multipart

    if (!file || !bucket || !path) {
      return badRequest(res, 'Missing file, bucket, or path');
    }

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) {
      logger.error('Storage upload error', { error: uploadError });
      return serverError(res, 'Upload failed');
    }

    ok(res, { path: data.path });
  } catch (err) {
    logger.error('Upload error', { err: err.message });
    error(res, 'Upload failed');
  }
}

/**
 * Get public URL for file
 */
export async function getPublicUrl(req, res) {
  try {
    const { bucket, path } = req.query;

    if (!bucket || !path) {
      return badRequest(res, 'Missing bucket or path');
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    ok(res, { publicUrl: data.publicUrl });
  } catch (err) {
    logger.error('Get public URL error', { err: err.message });
    error(res, 'Failed to get URL');
  }
}

/**
 * Create signed URL
 */
export async function createSignedUrl(req, res) {
  try {
    const { bucket, path, expiresIn = 3600 } = req.body;

    if (!bucket || !path) {
      return badRequest(res, 'Missing bucket or path');
    }

    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (signError) {
      logger.error('Create signed URL error', { error: signError });
      return serverError(res, 'Failed to create signed URL');
    }

    ok(res, { signedUrl: data.signedUrl });
  } catch (err) {
    logger.error('Create signed URL error', { err: err.message });
    error(res, 'Failed to create signed URL');
  }
}

/**
 * Delete file
 */
export async function deleteFile(req, res) {
  try {
    const { bucket, paths } = req.body;

    if (!bucket || !paths || !Array.isArray(paths)) {
      return error(res, 'Missing bucket or paths array');
    }

    const { data, error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(paths);

    if (deleteError) {
      logger.error('Delete file error', { error: deleteError });
      return serverError(res, 'Delete failed');
    }

    ok(res, { deleted: data });
  } catch (err) {
    logger.error('Delete file error', { err: err.message });
    error(res, 'Delete failed');
  }
}