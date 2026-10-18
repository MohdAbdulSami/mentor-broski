import { MentorDomain, StageRoadmap } from '../types';
import { MasterCurriculumDefinition, DailyMissionDefinition } from './types';
import { AI_ML_90_MASTER_CURRICULUM } from './aiMlCurriculum';
import { CYBERSECURITY_90_MASTER_CURRICULUM } from './cybersecurityCurriculum';
import { DATA_SCIENCE_90_MASTER_CURRICULUM } from './dataScienceCurriculum';

export const MASTER_CURRICULA: Record<MentorDomain, MasterCurriculumDefinition> = {
  AI_ML: AI_ML_90_MASTER_CURRICULUM,
  CYBERSECURITY: CYBERSECURITY_90_MASTER_CURRICULUM,
  DATA_SCIENCE: DATA_SCIENCE_90_MASTER_CURRICULUM
};

export class CurriculumRegistry {
  /**
   * Retrieve master curriculum by domain
   */
  static getMasterCurriculum(domain: MentorDomain): MasterCurriculumDefinition {
    return MASTER_CURRICULA[domain] || MASTER_CURRICULA.AI_ML;
  }

  /**
   * Slice missions up to totalDays, converting them into stages compatible with StageRoadmap schema
   */
  static buildStagesFromCurriculum(
    domain: MentorDomain,
    totalDays: number = 90,
    requestedLevel: string = 'BEGINNER'
  ): StageRoadmap[] {
    const curriculum = this.getMasterCurriculum(domain);
    const cleanLevel = (requestedLevel || 'BEGINNER').toUpperCase();

    let startDay = 1;
    if (cleanLevel === 'INTERMEDIATE') {
      startDay = 31;
    } else if (cleanLevel === 'ADVANCED') {
      startDay = 61;
    }

    const endDay = Math.min(startDay + totalDays - 1, curriculum.totalDays);
    const selectedMissions = curriculum.missions.filter(m => m.day >= startDay && m.day <= endDay);

    const stages: StageRoadmap[] = [];

    // Stage 1: Days 1–10 (Core Foundations & Technical Setup)
    const stage1Tasks = selectedMissions.filter(m => m.day >= 1 && m.day <= 10);
    if (stage1Tasks.length > 0) {
      stages.push({
        stageNumber: 1,
        stageTitle: `Phase 1: ${cleanLevel} Core Foundations & Technical Setup (Days 1–10)`,
        description: 'Master core tools, syntax, and foundational environment setup.',
        durationDays: stage1Tasks.length,
        tasks: stage1Tasks
      });
    }

    // Stage 2: Days 11–30 (Applied Projects & Domain Foundations)
    const stage2Tasks = selectedMissions.filter(m => m.day >= 11 && m.day <= 30);
    if (stage2Tasks.length > 0) {
      stages.push({
        stageNumber: 2,
        stageTitle: `Phase 2: Applied Projects & Domain Mastery (Days 11–30)`,
        description: 'Build real-world projects and master core domain workflows.',
        durationDays: stage2Tasks.length,
        tasks: stage2Tasks
      });
    }

    // Stage 3: Days 31–60 (Advanced Architectures & Production Scaling)
    const stage3Tasks = selectedMissions.filter(m => m.day >= 31 && m.day <= 60);
    if (stage3Tasks.length > 0) {
      stages.push({
        stageNumber: 3,
        stageTitle: `Phase 3: Advanced Architectures & Production Scaling (Days 31–60)`,
        description: 'Advanced topics, neural models, cloud deployment, and system architecture.',
        durationDays: stage3Tasks.length,
        tasks: stage3Tasks
      });
    }

    // Stage 4: Days 61–90 (Enterprise System Engineering & Mastery)
    const stage4Tasks = selectedMissions.filter(m => m.day >= 61 && m.day <= 90);
    if (stage4Tasks.length > 0) {
      stages.push({
        stageNumber: 4,
        stageTitle: `Phase 4: Enterprise System Engineering & Mastery (Days 61–90)`,
        description: 'Custom model engineering, kernel exploits, and enterprise architecture.',
        durationDays: stage4Tasks.length,
        tasks: stage4Tasks
      });
    }

    return stages;
  }
}
