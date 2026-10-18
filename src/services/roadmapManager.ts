import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MentorDomain, DbRoadmapRecord, RoadmapPlan, StageRoadmap, ActionItem, ResourceLink } from '../types';
import { ActivityTracker } from './activityTracker';
import { CurriculumRegistry } from '../curriculum/curriculumRegistry';

export interface DbRoadmapTemplateRecord {
  id: string;
  normalized_key: string;
  domain: string;
  level: string;
  duration: number;
  focus: string;
  title: string;
  summary?: string | null;
  stages: StageRoadmap[];
  version: number;
  created_at: string;
}

export class RoadmapManager {
  static normalizeKey(domain: string, level: string = 'BEGINNER', duration: number = 30, focus: string = 'GENERAL'): string {
    const cleanDomain = (domain || 'AI_ML').toUpperCase();
    const cleanLevel = (level || 'BEGINNER').toUpperCase();
    const cleanDur = Number(duration) || 30;
    const cleanFocus = (focus || 'GENERAL').toUpperCase();
    return `${cleanDomain}:${cleanLevel}:${cleanDur}:${cleanFocus}`;
  }

  static async getOrCreateRoadmapTemplate(
    domain: MentorDomain,
    level: string = 'BEGINNER',
    duration: number = 30,
    focus: string = 'GENERAL'
  ): Promise<DbRoadmapTemplateRecord | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const cleanDomain = (domain || 'AI_ML').toUpperCase() as MentorDomain;
    const cleanLevel = (level || 'BEGINNER').toUpperCase();
    const cleanDur = Number(duration) || 30;
    const cleanFocus = (focus || 'GENERAL').toUpperCase();
    const normalizedKey = this.normalizeKey(cleanDomain, cleanLevel, cleanDur, cleanFocus);

    try {
      // 1. Check if matching shared template exists in DB
      const { data: existingTemplate } = await supabase
        .from('roadmap_templates')
        .select('*')
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (existingTemplate && existingTemplate.stages && existingTemplate.stages.length > 0) {
        return existingTemplate as DbRoadmapTemplateRecord;
      }

      // Check if it's one of the valid standard configurations or prefix for extension
      const validDurations = [30, 60, 90, 100, 120];
      const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
      const validDomains = ['AI_ML', 'CYBERSECURITY', 'DATA_SCIENCE'];

      if (!validDomains.includes(cleanDomain) || !validLevels.includes(cleanLevel)) {
        console.warn(`Template configuration not found and not supported: ${normalizedKey}`);
        return null;
      }

      // Generate structured stages from master curriculum
      const generatedPlan = this.generateStructuredRoadmap(cleanDomain, cleanLevel, cleanDur, cleanFocus);

      const { data: createdTemplate, error } = await supabase
        .from('roadmap_templates')
        .upsert({
          normalized_key: normalizedKey,
          domain: cleanDomain,
          level: cleanLevel,
          duration: cleanDur,
          focus: cleanFocus,
          title: generatedPlan.title,
          summary: generatedPlan.summary,
          stages: generatedPlan.stages,
          version: 1
        }, { onConflict: 'normalized_key' })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error inserting roadmap template into Supabase:', error);
        return null;
      }

      return (createdTemplate as DbRoadmapTemplateRecord) || null;
    } catch (err) {
      console.error('Error in getOrCreateRoadmapTemplate:', err);
      return null;
    }
  }

  static async getOrCreateUserRoadmap(
    userId: string,
    domain: MentorDomain,
    level: string = 'BEGINNER',
    duration: number = 30,
    focus: string = 'GENERAL'
  ): Promise<DbRoadmapRecord | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    const cleanLevel = level.toUpperCase();
    const cleanDur = Number(duration) || 30;
    const cleanFocus = focus.toUpperCase();

    try {
      // 1. Check if user already has an active roadmap for this specific configuration
      const { data: existingUserRoadmap } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('user_id', userId)
        .eq('domain', domain)
        .eq('duration', cleanDur)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (existingUserRoadmap) {
        return existingUserRoadmap as DbRoadmapRecord;
      }

      // Use RoadmapResolver for full RETRIEVE and EXTEND capability
      const { RoadmapResolver } = await import('./roadmapResolver');
      const resolution = await RoadmapResolver.resolveRoadmap({
        userId,
        domain,
        requestedLevel: cleanLevel,
        requestedDuration: cleanDur,
        requestedFocus: cleanFocus
      });

      return resolution.roadmap;
    } catch (err) {
      console.error('Error in getOrCreateUserRoadmap:', err);
      return null;
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

  static async markTaskComplete(
    userId: string,
    roadmapId: string,
    taskId: string
  ): Promise<{ updatedRoadmap: DbRoadmapRecord | null; completedDayNumber: number; error?: string }> {
    if (!userId || !roadmapId || !isSupabaseConfigured || !supabase) {
      return { updatedRoadmap: null, completedDayNumber: 1, error: 'Database unconfigured or invalid parameters' };
    }

    try {
      // 1. Try PostgreSQL RPC first if authenticated
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_roadmap_task', {
        p_roadmap_id: roadmapId,
        p_task_id: taskId
      });

      if (!rpcError && rpcResult?.success) {
        const { data: updated } = await supabase
          .from('roadmaps')
          .select('*')
          .eq('id', roadmapId)
          .eq('user_id', userId)
          .maybeSingle();

        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
        ActivityTracker.recordMissionEngagement(roadmapId, rpcResult.completed_day || 1).catch(() => {});
        return {
          updatedRoadmap: (updated as DbRoadmapRecord) || null,
          completedDayNumber: rpcResult.completed_day || 1
        };
      }

      // If RPC raised a security violation exception, reject immediately
      if (rpcError && rpcError.message && (
        rpcError.message.includes('Progression security violation') || 
        rpcError.message.includes('Prerequisite violation')
      )) {
        console.warn('Progression security violation rejected by RPC:', rpcError.message);
        return {
          updatedRoadmap: null,
          completedDayNumber: 1,
          error: rpcError.message
        };
      }

      // 2. Client-side fallback with identical progression security checks
      const { data: current } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('id', roadmapId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!current || !current.stages) {
        return { updatedRoadmap: null, completedDayNumber: 1, error: 'Roadmap not found' };
      }

      const currentDay = current.current_day || 1;
      const stages = current.stages as StageRoadmap[];

      // Locate target task
      let targetTask: ActionItem | null = null;
      for (const stage of stages) {
        for (const task of stage.tasks) {
          if (task.id === taskId || `task-${task.day}` === taskId) {
            targetTask = task;
            break;
          }
        }
        if (targetTask) break;
      }

      if (!targetTask) {
        return { updatedRoadmap: null, completedDayNumber: currentDay, error: `Task ${taskId} not found` };
      }

      // Security Check: Current day must match task day
      if (targetTask.day !== currentDay) {
        const errorMsg = `Progression security violation: Cannot complete Day ${targetTask.day} task while on Day ${currentDay}. Future days are locked.`;
        console.warn(errorMsg);
        return { updatedRoadmap: null, completedDayNumber: currentDay, error: errorMsg };
      }

      // Security Check: All prerequisite tasks for previous days must be completed
      for (const stage of stages) {
        for (const task of stage.tasks) {
          if (task.day < currentDay && !task.completed) {
            const errorMsg = `Prerequisite violation: Day ${task.day} task must be completed before Day ${currentDay}.`;
            console.warn(errorMsg);
            return { updatedRoadmap: null, completedDayNumber: currentDay, error: errorMsg };
          }
        }
      }

      let completedDayNumber = targetTask.day;
      const updatedStages = stages.map(stage => ({
        ...stage,
        tasks: stage.tasks.map(task => {
          if (task.id === taskId || `task-${task.day}` === taskId) {
            return {
              ...task,
              completed: true,
              completedAt: new Date().toISOString()
            };
          }
          return task;
        })
      }));

      // Persist task completion WITHOUT advancing current_day.
      // The mentor will ask "Continue now or tomorrow?" before unlocking the next day.
      const { data: updated } = await supabase
        .from('roadmaps')
        .update({
          stages: updatedStages
        })
        .eq('id', roadmapId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});

      return {
        updatedRoadmap: (updated as DbRoadmapRecord) || null,
        completedDayNumber
      };
    } catch (err: any) {
      console.error('Error marking roadmap task complete in Supabase:', err);
      return { updatedRoadmap: null, completedDayNumber: 1, error: err?.message || 'Error completing task' };
    }
  }

  /**
   * Explicitly advances current_day to the next unlocked day.
   * Call this ONLY after the user confirms "continue now" in the mentor conversation or drawer UI.
   */
  static async advanceToNextDay(
    userId: string,
    roadmapId: string,
    completedDayNumber: number
  ): Promise<DbRoadmapRecord | null> {
    if (!userId || !roadmapId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('advance_roadmap_day', {
        p_roadmap_id: roadmapId,
        p_completed_day: completedDayNumber
      });

      if (rpcError) {
        console.warn('advance_roadmap_day blocked by database security:', rpcError.message);
        return null;
      }

      if (rpcResult?.success) {
        ActivityTracker.markMissionCompleted(roadmapId, completedDayNumber).catch(() => {});
        const { data: updated } = await supabase
          .from('roadmaps')
          .select('*')
          .eq('id', roadmapId)
          .eq('user_id', userId)
          .maybeSingle();

        return (updated as DbRoadmapRecord) || null;
      }

      return null;
    } catch (err) {
      console.error('Error advancing to next day in Supabase:', err);
      return null;
    }
  }

  static isTaskAccessible(currentDay: number, taskDay: number): boolean {
    return taskDay <= currentDay;
  }

  static generateStructuredRoadmap(
    domain: MentorDomain,
    level: string = 'BEGINNER',
    totalDays: number = 30,
    focus: string = 'GENERAL'
  ): RoadmapPlan {
    const isAI = domain === 'AI_ML';
    const isCyber = domain === 'CYBERSECURITY';
    const mentorId = isAI ? 'AARYA' : isCyber ? 'ALEX' : 'LUCY';
    const cleanLevel = level.toUpperCase();
    const duration = Number(totalDays) || 30;

    const stages = CurriculumRegistry.buildStagesFromCurriculum(domain, duration, cleanLevel);

    return {
      mentorId,
      domain,
      createdDate: new Date().toLocaleDateString(),
      title: isAI ? `${duration}-Day ${cleanLevel} AI/ML Engineering Plan` : isCyber ? `${duration}-Day ${cleanLevel} Cybersecurity & Pentesting Plan` : `${duration}-Day ${cleanLevel} Data Science Engineering Plan`,
      summary: `A continuous ${duration}-day master curriculum (${cleanLevel} / ${focus}).`,
      currentDay: 1,
      stages
    };
  }
}
