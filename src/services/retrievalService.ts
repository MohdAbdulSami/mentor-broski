import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  MentorId, 
  MentorDomain, 
  PersonalityStyle, 
  UserProfile, 
  DbMemoryRecord, 
  DbCommitmentRecord, 
  DbRoadmapRecord,
  ChatMessage,
  ClassificationResult
} from '../types';

export class RetrievalService {
  static async validateConversationOwnership(userId: string, conversationId: string): Promise<boolean> {
    if (!userId || !conversationId || !isSupabaseConfigured || !supabase) return false;
    try {
      const { data } = await supabase
        .from('conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      return Boolean(data);
    } catch {
      return false;
    }
  }

  static async getOrCreateConversation(
    userId: string,
    mentorId: MentorId,
    personality: PersonalityStyle | null
  ): Promise<string | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('mentor_id', mentorId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      const { data: created } = await supabase
        .from('conversations')
        .upsert(
          {
            user_id: userId,
            mentor_id: mentorId,
            personality: personality || 'FRIENDLY',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,mentor_id' }
        )
        .select()
        .maybeSingle();

      return created ? created.id : null;
    } catch (err) {
      console.error('Error getting or creating conversation in Supabase:', err);
      return null;
    }
  }

  static async getRelevantProfile(userId: string): Promise<Partial<UserProfile> | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) return null;

      return {
        id: profile.user_id,
        name: profile.full_name || 'Student',
        email: profile.email,
        academicYear: profile.academic_year,
        education: profile.education,
        targetRole: profile.target_role,
        experienceLevel: profile.experience_level,
        weeklyHours: profile.weekly_hours,
        learningStyle: profile.learning_style,
        interests: profile.interests,
        selectedMentor: profile.active_mentor_id as MentorId,
        personality: profile.personality as PersonalityStyle,
        onboardingStep: profile.onboarding_step,
        onboardingCompleted: profile.onboarding_completed
      };
    } catch (err) {
      console.error('Error fetching user profile from Supabase:', err);
      return null;
    }
  }

  static async getRelevantMemories(userId: string, categoryFilter?: string): Promise<DbMemoryRecord[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      let query = supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (categoryFilter) {
        query = query.eq('key_category', categoryFilter);
      }

      const { data } = await query;
      return (data as DbMemoryRecord[]) || [];
    } catch (err) {
      console.error('Error fetching memories from Supabase:', err);
      return [];
    }
  }

  static async getActiveCommitments(userId: string): Promise<DbCommitmentRecord[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      return (data as DbCommitmentRecord[]) || [];
    } catch (err) {
      console.error('Error fetching active commitments from Supabase:', err);
      return [];
    }
  }

  static async getCurrentRoadmap(userId: string, domain: MentorDomain): Promise<DbRoadmapRecord | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('user_id', userId)
        .eq('domain', domain)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .maybeSingle();

      return (data as DbRoadmapRecord) || null;
    } catch (err) {
      console.error('Error fetching roadmap from Supabase:', err);
      return null;
    }
  }

  static async getRecentMessages(conversationId: string, limit = 10): Promise<ChatMessage[]> {
    if (!conversationId || !isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!data) return [];

      return data.map((m: any) => ({
        id: m.id,
        sender: m.sender as 'user' | 'mentor' | 'system',
        text: m.text,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resources: m.resources,
        suggestPlanTrigger: m.suggest_plan_trigger,
        isProactiveCheckIn: m.is_proactive
      }));
    } catch (err) {
      console.error('Error fetching recent messages from Supabase:', err);
      return [];
    }
  }

  // Selective Query-Dependent Retrieval Manager
  static async retrieveQueryDependentContext(params: {
    userId: string;
    conversationId: string;
    domain: MentorDomain;
    signals: ClassificationResult['signals'];
    userMessage: string;
  }): Promise<{
    profile: Partial<UserProfile> | null;
    memories: DbMemoryRecord[];
    commitments: DbCommitmentRecord[];
    roadmap: DbRoadmapRecord | null;
    recentMessages: ChatMessage[];
  }> {
    const { userId, conversationId, domain, signals, userMessage } = params;
    const lower = userMessage.toLowerCase();

    // Always retrieve recent conversation history
    const messagesPromise = this.getRecentMessages(conversationId, 10);

    // Rule 1: CASUAL queries require NO personal database retrieval
    if (signals.isCasual && !signals.isMemoryCandidate && !signals.isCommitmentCandidate && !signals.isProfileUpdate) {
      const recentMessages = await messagesPromise;
      return { profile: null, memories: [], commitments: [], roadmap: null, recentMessages };
    }

    // Rule 2: Preference / Memory Query ("what kind of learning do I prefer", "what did I tell you")
    const isPreferenceQuery = lower.includes('preference') || lower.includes('prefer') || lower.includes('what did i tell you') || lower.includes('my goal') || lower.includes('my skill');

    // Rule 3: Roadmap / Daily Work Query ("what should I work on today", "roadmap", "today's task")
    const isWorkOrRoadmapQuery = lower.includes('work on today') || lower.includes('task') || lower.includes('roadmap') || lower.includes('plan') || signals.isRoadmapUpdate;

    let profilePromise: Promise<Partial<UserProfile> | null> = Promise.resolve(null);
    let memoriesPromise: Promise<DbMemoryRecord[]> = Promise.resolve([]);
    let commitmentsPromise: Promise<DbCommitmentRecord[]> = Promise.resolve([]);
    let roadmapPromise: Promise<DbRoadmapRecord | null> = Promise.resolve(null);

    if (isPreferenceQuery) {
      profilePromise = this.getRelevantProfile(userId);
      memoriesPromise = this.getRelevantMemories(userId);
    } else if (isWorkOrRoadmapQuery) {
      profilePromise = this.getRelevantProfile(userId);
      memoriesPromise = this.getRelevantMemories(userId);
      commitmentsPromise = this.getActiveCommitments(userId);
      roadmapPromise = this.getCurrentRoadmap(userId, domain);
    } else {
      // General / Mentor Question: Parallel retrieval of profile, memories, commitments
      profilePromise = this.getRelevantProfile(userId);
      memoriesPromise = this.getRelevantMemories(userId);
      commitmentsPromise = this.getActiveCommitments(userId);
      if (signals.isRoadmapUpdate || lower.includes('roadmap') || lower.includes('plan')) {
        roadmapPromise = this.getCurrentRoadmap(userId, domain);
      }
    }

    // Independent database calls executed in parallel with Promise.all()
    const [profile, memories, commitments, roadmap, recentMessages] = await Promise.all([
      profilePromise,
      memoriesPromise,
      commitmentsPromise,
      roadmapPromise,
      messagesPromise
    ]);

    return { profile, memories, commitments, roadmap, recentMessages };
  }

  static async persistMessage(
    conversationId: string,
    userId: string,
    sender: 'user' | 'mentor' | 'system',
    text: string,
    extra?: { resources?: any; suggestPlanTrigger?: boolean; isProactive?: boolean; isReminder?: boolean; commitmentId?: string }
  ): Promise<ChatMessage | null> {
    if (!conversationId || !isSupabaseConfigured || !supabase) {
      return {
        id: 'msg_local_' + Date.now(),
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resources: extra?.resources,
        suggestPlanTrigger: extra?.suggestPlanTrigger,
        isProactiveCheckIn: extra?.isProactive
      };
    }

    try {
      const { data } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          sender,
          text,
          resources: extra?.resources || null,
          suggest_plan_trigger: extra?.suggestPlanTrigger || false,
          is_proactive: extra?.isProactive || false
        })
        .select()
        .maybeSingle();

      if (!data) return null;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        id: data.id,
        sender: data.sender as 'user' | 'mentor' | 'system',
        text: data.text,
        timestamp: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resources: data.resources,
        suggestPlanTrigger: data.suggest_plan_trigger,
        isProactiveCheckIn: data.is_proactive
      };
    } catch (err) {
      console.error('Error persisting message to Supabase:', err);
      return null;
    }
  }
}
