import { AnalyticsEvent } from '../types';

const ANALYTICS_STORAGE_KEY = 'mentorbroski_analytics_events';

export class AnalyticsService {
  static track(eventName: string, metadata?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      eventName,
      metadata,
      createdAt: new Date().toISOString()
    };

    console.log(`[ANALYTICS EVENT] ${eventName}`, metadata || '');

    try {
      const existing = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      const events: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
      events.push(event);
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(events.slice(-100)));
    } catch (err) {
      console.error('Failed to log analytics event:', err);
    }
  }

  static getEvents(): AnalyticsEvent[] {
    try {
      const existing = localStorage.getItem(ANALYTICS_STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  }
}
