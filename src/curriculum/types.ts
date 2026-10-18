import { ResourceLink, ActionItem, StageRoadmap } from '../types';

export type CurriculumOrigin = 'CURATED' | 'GENERATED';

export interface CurriculumAssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface CurriculumAssessment {
  day: number;
  topic: string;
  passingScorePercent: number; // default 70
  questions: CurriculumAssessmentQuestion[];
}

export interface DailyMissionDefinition extends ActionItem {
  phase: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'SPECIALIZATION';
  learningObjectives: string[];
  assessment?: CurriculumAssessment;
}

export interface MasterCurriculumDefinition {
  id: string;
  domain: 'AI_ML' | 'CYBERSECURITY' | 'DATA_SCIENCE';
  origin: CurriculumOrigin;
  version: number;
  title: string;
  description: string;
  totalDays: number; // e.g. 90
  phases: {
    phaseNumber: number;
    phaseName: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'SPECIALIZATION';
    startDay: number;
    endDay: number;
    summary: string;
  }[];
  missions: DailyMissionDefinition[];
}
