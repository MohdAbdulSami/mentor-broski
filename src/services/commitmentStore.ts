import { Commitment, UserMemory } from '../types';
import { CommitmentProcessor } from './commitmentProcessor';
import { MemoryStore } from './memoryStore';

export class CommitmentStore {
  static extractCommitmentFromMessage(text: string): Commitment | null {
    const extracted = CommitmentProcessor.extractCommitment(text);
    if (!extracted) return null;

    return {
      id: 'cmt_' + Date.now(),
      statement: extracted.statement,
      targetWindow: extracted.targetWindow,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
  }

  static addCommitment(_commitment: Commitment): UserMemory {
    // Deprecated: Commitments saved directly to Supabase DB via CommitmentProcessor.saveCommitment()
    return MemoryStore.getMemory();
  }

  static getPendingCommitments(): Commitment[] {
    return [];
  }

  static markCommitmentStatus(_id: string, _status: 'MET' | 'MISSED' | 'EXCUSED'): UserMemory {
    // Deprecated: Status updated directly in Supabase DB via CommitmentProcessor.updateCommitmentStatus()
    return MemoryStore.getMemory();
  }
}
