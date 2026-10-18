import { ScheduledBackendAction, MentorId } from '../types';

export interface ProactiveCheckInState {
  lastCheckInAt?: string;
  unrespondedCheckInCount: number;
  stoppedDueToNoResponse: boolean;
}

export class SchedulerService {
  private static proactiveState: ProactiveCheckInState = {
    unrespondedCheckInCount: 0,
    stoppedDueToNoResponse: false
  };

  static getScheduledActions(): ScheduledBackendAction[] {
    return [];
  }

  static getProactiveState(): ProactiveCheckInState {
    return this.proactiveState;
  }

  static saveProactiveState(state: ProactiveCheckInState): void {
    this.proactiveState = state;
  }

  static onUserResponded(): void {
    this.proactiveState = {
      unrespondedCheckInCount: 0,
      stoppedDueToNoResponse: false
    };
  }

  static canSendProactiveMessage(): boolean {
    return !this.proactiveState.stoppedDueToNoResponse;
  }

  static recordProactiveMessageSent(): void {
    this.proactiveState.lastCheckInAt = new Date().toISOString();
    this.proactiveState.unrespondedCheckInCount += 1;
    if (this.proactiveState.unrespondedCheckInCount >= 2) {
      this.proactiveState.stoppedDueToNoResponse = true;
    }
  }

  static scheduleCommitmentCheckIn(
    userId: string,
    mentorId: MentorId,
    commitmentId: string,
    taskTitle: string,
    targetTimeISO: string
  ): ScheduledBackendAction {
    return {
      id: 'sch_' + Date.now(),
      userId,
      mentorId,
      type: 'COMMITMENT_REMINDER',
      scheduledFor: targetTimeISO,
      payload: { commitmentId, taskTitle },
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
  }

  static getDueActions(): ScheduledBackendAction[] {
    return [];
  }

  static markActionSent(_id: string): void {
    // Deprecated: Managed via Supabase DB commitments table notification_status
  }
}
