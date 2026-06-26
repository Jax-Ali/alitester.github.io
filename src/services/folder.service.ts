import { supabase } from '@/lib/supabase';
import type { FolderRow, InsertFolder } from '@/types';

export const folderService = {
  async getByUser(userId: string): Promise<FolderRow[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(folder: InsertFolder): Promise<FolderRow> {
    const { data, error } = await supabase
      .from('folders')
      .insert(folder)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, name: string): Promise<FolderRow> {
    const { data, error } = await supabase
      .from('folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
