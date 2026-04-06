import { supabase } from '../config/supabase.js';
import { ok, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function getNotifications(req, res) {
  try {
    const { id: userId } = req.user;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return ok(res, data ?? []);
  } catch (err) {
    logger.error('getNotifications error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function markNotificationRead(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return ok(res, null, 'Notification marked as read');
  } catch (err) {
    logger.error('markNotificationRead error', { err: err.message });
    return serverError(res, err.message);
  }
}

export async function markAllRead(req, res) {
  try {
    const { id: userId } = req.user;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return ok(res, null, 'All notifications marked as read');
  } catch (err) {
    logger.error('markAllRead error', { err: err.message });
    return serverError(res, err.message);
  }
}
