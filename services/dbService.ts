
import { supabase } from './supabaseService';

export class DBService {
  /**
   * Fetches all registered members from Supabase profiles.
   */
  static async getAllMembers(): Promise<any[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch members:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Verification check for Admin privileges on the server-side metadata.
   */
  static async checkIsAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (error) return false;
    return data?.is_admin || false;
  }
}
