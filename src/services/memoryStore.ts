import { UserMemory, UserProfile, DbMemoryRecord, DbCommitmentRecord } from '../types';

export const initialMemory: UserMemory = {
  academicSituation: 'Not specified yet',
  currentSkills: [],
  careerGoal: 'Exploring career paths',
  timeline: 'Flexible',
  motivation: '',
  currentObstacles: '',
  preferredLearningWindow: 'Evening (7 PM - 10 PM)',
  behavioralPatterns: ['Prefers practical hands-on examples'],
  commitments: [],
  completedMilestones: [],
  lastUpdated: new Date().toISOString()
};

export class MemoryStore {
  static buildUserMemoryFromDb(
    profile: Partial<UserProfile> | null,
    dbMemories: DbMemoryRecord[],
    dbCommitments: DbCommitmentRecord[] = []
  ): UserMemory {
    const academicSituation =
      profile?.academicYear ||
      dbMemories.find(m => m.key_category === 'academic_situation')?.content ||
      'Not specified yet';

    const careerGoal =
      profile?.targetRole ||
      dbMemories.find(m => m.key_category === 'career_goal')?.content ||
      'Exploring options';

    const skillRecords = dbMemories
      .filter(m => m.key_category === 'skill')
      .map(m => m.content.replace(/^Knows or learning\s+/i, ''));

    const preferredLearningWindow =
      dbMemories.find(m => m.key_category === 'preferred_learning_window')?.content ||
      'Flexible';

    const currentObstacles =
      dbMemories.find(m => m.key_category === 'current_obstacles')?.content || '';

    return {
      academicSituation,
      currentSkills: skillRecords,
      careerGoal,
      timeline: 'Flexible',
      motivation: '',
      currentObstacles,
      preferredLearningWindow,
      behavioralPatterns: ['Prefers practical hands-on examples'],
      commitments: dbCommitments.map(c => ({
        id: c.id,
        statement: c.statement,
        targetWindow: c.target_window || 'soon',
        status: c.status === 'COMPLETED' || c.status === 'MET' ? 'MET' : 'PENDING',
        createdAt: c.created_at
      })),
      completedMilestones: [],
      lastUpdated: new Date().toISOString()
    };
  }

  static getMemory(): UserMemory {
    return initialMemory;
  }

  static saveMemory(_memory: UserMemory): void {
    // Deprecated: Supabase DB is authoritative for memories
  }

  static updateMemoryFromConversation(_userMessage: string, currentMemory: UserMemory): UserMemory {
    return currentMemory;
  }

  static clearMemory(): void {
    // Deprecated: Supabase DB is authoritative for memories
  }
}
