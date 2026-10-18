import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

export class ProfileUpdater {
  static extractProfileUpdates(text: string): { academicYear?: string; targetRole?: string } {
    const lower = text.toLowerCase();
    const updates: { academicYear?: string; targetRole?: string } = {};

    // Academic Year
    if (lower.includes('1st year') || lower.includes('first year') || lower.includes('freshman')) {
      updates.academicYear = '1st Year Student';
    } else if (lower.includes('2nd year') || lower.includes('second year') || lower.includes('sophomore')) {
      updates.academicYear = '2nd Year Student';
    } else if (lower.includes('3rd year') || lower.includes('third year') || lower.includes('junior')) {
      updates.academicYear = '3rd Year Student';
    } else if (lower.includes('4th year') || lower.includes('final year') || lower.includes('senior')) {
      updates.academicYear = '4th Year / Final Year Student';
    } else if (lower.includes('graduated') || lower.includes('recent graduate')) {
      updates.academicYear = 'Recent Graduate';
    }

    // Target Role
    if (lower.includes('ai engineer') || lower.includes('machine learning engineer')) {
      updates.targetRole = 'AI / ML Engineer';
    } else if (lower.includes('product manager') || lower.includes('pm role')) {
      updates.targetRole = 'Product Manager';
    } else if (lower.includes('cybersecurity') || lower.includes('security analyst')) {
      updates.targetRole = 'Cybersecurity Analyst';
    } else if (lower.includes('data scientist') || lower.includes('data analyst')) {
      updates.targetRole = 'Data Scientist';
    }

    return updates;
  }

  static async updateProfileIfChanged(
    userId: string,
    currentProfile: Partial<UserProfile> | null,
    text: string
  ): Promise<Partial<UserProfile> | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return currentProfile;

    const updates = this.extractProfileUpdates(text);
    if (!updates.academicYear && !updates.targetRole) {
      return currentProfile;
    }

    const payload: Record<string, any> = {};

    // Only update if not already set to the same value
    if (updates.academicYear && updates.academicYear !== currentProfile?.academicYear) {
      payload.academic_year = updates.academicYear;
    }
    if (updates.targetRole && updates.targetRole !== currentProfile?.targetRole) {
      payload.target_role = updates.targetRole;
    }

    if (Object.keys(payload).length === 0) {
      return currentProfile;
    }

    payload.updated_at = new Date().toISOString();

    try {
      const { data: updated } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (updated) {
        return {
          ...currentProfile,
          academicYear: updated.academic_year,
          targetRole: updated.target_role
        };
      }
    } catch (err) {
      console.error('Error updating profile in Supabase:', err);
    }

    return currentProfile;
  }
}
