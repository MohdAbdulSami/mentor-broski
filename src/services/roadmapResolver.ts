import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MentorDomain, DbRoadmapRecord, StageRoadmap } from '../types';
import { CurriculumRegistry } from '../curriculum/curriculumRegistry';
import { RoadmapExtensionService } from './roadmapExtensionService';
import { RoadmapManager } from './roadmapManager';

export type ResolutionMode = 'RETRIEVE' | 'EXTEND' | 'GENERATE';

export interface ResolutionRequest {
  userId: string;
  domain: MentorDomain;
  requestedLevel?: string; // 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  requestedDuration?: number; // e.g. 30, 60, 90, 100, 120
  requestedFocus?: string;
  userGoal?: string;
  explicitStartDay?: number;
}

export interface ResolutionResult {
  roadmap: DbRoadmapRecord | null;
  mode: ResolutionMode;
  baseDaysCount: number;
  extendedDaysCount: number;
  totalDays: number;
  startingDay: number;
  message: string;
}

export class RoadmapResolver {
  /**
   * Authoritative 3-Way Roadmap Resolver supporting:
   * 1. Operation A: RETRIEVE — Find compatible curated/persisted template (e.g. 30, 60, 90 days)
   * 2. Operation B: EXTEND — Preserve longest complete compatible prefix and generate missing continuous days (e.g. 90 -> 100 days)
   * 3. Operation C: GENERATE — When no compatible curriculum exists, prepare custom structured curriculum matching data contract
   */
  static async resolveRoadmap(request: ResolutionRequest): Promise<ResolutionResult> {
    const {
      userId,
      domain,
      requestedLevel = 'BEGINNER',
      requestedDuration = 30,
      requestedFocus = 'GENERAL',
      userGoal,
      explicitStartDay
    } = request;

    const cleanLevel = (requestedLevel || 'BEGINNER').toUpperCase();
    const cleanDur = Number(requestedDuration) || 30;
    const cleanFocus = (requestedFocus || 'GENERAL').toUpperCase();

    // Determine initial starting day based on experience level unless explicitly requested
    let startingDay = 1;
    if (explicitStartDay && explicitStartDay > 0) {
      startingDay = explicitStartDay;
    } else if (cleanLevel === 'INTERMEDIATE') {
      startingDay = 31;
    } else if (cleanLevel === 'ADVANCED') {
      startingDay = 61;
    }

    if (!userId || !isSupabaseConfigured || !supabase) {
      return {
        roadmap: null,
        mode: 'RETRIEVE',
        baseDaysCount: 0,
        extendedDaysCount: 0,
        totalDays: cleanDur,
        startingDay,
        message: 'Database connection unavailable.'
      };
    }

    try {
      // 1. Check if user already has an active roadmap for this exact domain & duration
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
        return {
          roadmap: existingUserRoadmap as DbRoadmapRecord,
          mode: cleanDur > 90 ? 'EXTEND' : 'RETRIEVE',
          baseDaysCount: Math.min(cleanDur, 90),
          extendedDaysCount: Math.max(0, cleanDur - 90),
          totalDays: cleanDur,
          startingDay: existingUserRoadmap.current_day || startingDay,
          message: `Retrieved active ${cleanDur}-Day ${domain.replace('_', '/')} Roadmap.`
        };
      }

      // Check master curriculum limit
      const masterCurriculum = CurriculumRegistry.getMasterCurriculum(domain);
      const isCuratedCompatible = Boolean(masterCurriculum && masterCurriculum.missions.length >= 90);

      // ==========================================
      // OPERATION A: RETRIEVE (Duration <= 90 days)
      // ==========================================
      if (cleanDur <= 90 && isCuratedCompatible) {
        // Fetch or create template up to cleanDur days
        const baseStages = CurriculumRegistry.buildStagesFromCurriculum(domain, cleanDur, cleanLevel);
        const template = await RoadmapManager.getOrCreateRoadmapTemplate(domain, cleanLevel, cleanDur, cleanFocus);

        const { data: createdRoadmap, error } = await supabase
          .from('roadmaps')
          .insert({
            user_id: userId,
            template_id: template?.id || null,
            domain: domain,
            level: cleanLevel,
            duration: cleanDur,
            focus: cleanFocus,
            title: `${cleanDur}-Day ${cleanLevel} ${domain.replace('_', '/')} Engineering Plan`,
            summary: `Continuous ${cleanDur}-day curriculum for ${domain.replace('_', '/')}.`,
            current_day: startingDay,
            stages: baseStages,
            status: 'ACTIVE'
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error inserting resolved roadmap:', error);
          return {
            roadmap: null,
            mode: 'RETRIEVE',
            baseDaysCount: cleanDur,
            extendedDaysCount: 0,
            totalDays: cleanDur,
            startingDay,
            message: 'Database error saving roadmap.'
          };
        }

        return {
          roadmap: createdRoadmap as DbRoadmapRecord,
          mode: 'RETRIEVE',
          baseDaysCount: cleanDur,
          extendedDaysCount: 0,
          totalDays: cleanDur,
          startingDay,
          message: `Successfully retrieved ${cleanDur}-Day curriculum from library.`
        };
      }

      // ==========================================
      // OPERATION B: EXTEND (Duration > 90 days)
      // e.g. 100-day request: Reuse Days 1–90 prefix, generate Days 91–100 immediately
      // ==========================================
      if (cleanDur > 90 && isCuratedCompatible) {
        // 1. Longest compatible complete prefix = 90 days
        const baseStages = CurriculumRegistry.buildStagesFromCurriculum(domain, 90, cleanLevel);
        const basePrefixTemplate = await RoadmapManager.getOrCreateRoadmapTemplate(domain, cleanLevel, 90, cleanFocus);

        // 2. Context-aware extension for Days 91..cleanDur
        const extendedMissions = RoadmapExtensionService.generateExtensionMissions({
          domain,
          startDay: 91,
          endDay: cleanDur,
          baseStages,
          requestedFocus: cleanFocus,
          userGoal
        });

        // 3. Assemble complete continuous stages
        const combinedStages: StageRoadmap[] = [...baseStages];
        const extensionDuration = cleanDur - 90;
        combinedStages.push({
          stageNumber: combinedStages.length + 1,
          stageTitle: `Phase ${combinedStages.length + 1}: Enterprise Mastery & Specialization (Days 91–${cleanDur})`,
          description: `Custom context-aware extension building upon Day 90 competencies.`,
          durationDays: extensionDuration,
          tasks: extendedMissions
        });

        // 4. Persist extended user roadmap
        const { data: createdExtendedRoadmap, error } = await supabase
          .from('roadmaps')
          .insert({
            user_id: userId,
            template_id: basePrefixTemplate?.id || null,
            domain: domain,
            level: cleanLevel,
            duration: cleanDur,
            focus: cleanFocus,
            title: `${cleanDur}-Day ${cleanLevel} ${domain.replace('_', '/')} Extended Engineering Plan`,
            summary: `Continuous extended ${cleanDur}-day curriculum (${90} days curated + ${extensionDuration} specialized days).`,
            current_day: startingDay,
            stages: combinedStages,
            status: 'ACTIVE'
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error creating extended roadmap in Supabase:', error);
          return {
            roadmap: null,
            mode: 'EXTEND',
            baseDaysCount: 90,
            extendedDaysCount: cleanDur - 90,
            totalDays: cleanDur,
            startingDay,
            message: 'Database error saving extended roadmap.'
          };
        }

        return {
          roadmap: createdExtendedRoadmap as DbRoadmapRecord,
          mode: 'EXTEND',
          baseDaysCount: 90,
          extendedDaysCount: cleanDur - 90,
          totalDays: cleanDur,
          startingDay,
          message: `Successfully extended 90-day base curriculum with continuous specialized Days 91–${cleanDur}.`
        };
      }

      // ==========================================
      // OPERATION C: GENERATE (Fallback for unknown domains/configurations)
      // ==========================================
      const generatedStages = CurriculumRegistry.buildStagesFromCurriculum(domain, cleanDur, cleanLevel);
      const { data: generatedRoadmap, error } = await supabase
        .from('roadmaps')
        .insert({
          user_id: userId,
          domain: domain,
          level: cleanLevel,
          duration: cleanDur,
          focus: cleanFocus,
          title: `${cleanDur}-Day ${cleanLevel} ${domain.replace('_', '/')} Plan`,
          summary: `Curriculum generated for ${cleanLevel} ${domain}.`,
          current_day: startingDay,
          stages: generatedStages,
          status: 'ACTIVE'
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error saving generated roadmap:', error);
        return {
          roadmap: null,
          mode: 'GENERATE',
          baseDaysCount: 0,
          extendedDaysCount: cleanDur,
          totalDays: cleanDur,
          startingDay,
          message: 'Error generating roadmap.'
        };
      }

      return {
        roadmap: generatedRoadmap as DbRoadmapRecord,
        mode: 'GENERATE',
        baseDaysCount: 0,
        extendedDaysCount: cleanDur,
        totalDays: cleanDur,
        startingDay,
        message: `Generated custom ${cleanDur}-day curriculum matching unified data contract.`
      };
    } catch (err) {
      console.error('Error in RoadmapResolver.resolveRoadmap:', err);
      return {
        roadmap: null,
        mode: 'RETRIEVE',
        baseDaysCount: 0,
        extendedDaysCount: 0,
        totalDays: cleanDur,
        startingDay,
        message: 'Internal error during roadmap resolution.'
      };
    }
  }
}
