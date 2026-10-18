import { IntentType, MessageCategory, ClassificationResult } from '../types';

export class MessageClassifier {
  static classify(text: string): ClassificationResult {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Casual Signal Check
    const casualTriggers = [
      'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'greetings',
      'how are you', 'how is it going', 'how are u', "what's up", 'whatsup',
      'thanks', 'thank you', 'thx', 'ty', 'bye', 'goodbye', 'see ya',
      'good morning', 'good night', 'good evening', 'cool', 'awesome', 'ok', 'okay'
    ];
    
    // Exact match or matches greeting at start of short sentence
    const isExactCasual = casualTriggers.includes(lower);
    const isShortGreeting = trimmed.split(/\s+/).length <= 4 && casualTriggers.some(t => lower.startsWith(t) || lower.endsWith(t));
    const isCasual = isExactCasual || isShortGreeting;

    // 2. Commitment Candidate Signal Check
    const commitmentTriggers = [
      "i'll finish", "i will finish", "i'll complete", "i will complete",
      "i'll do", "i will do", "i promise", "i'm going to finish",
      "i plan to finish", "i'll build", "i will build", "i'll submit", "i will submit",
      "i'll study", "i will study", "by tomorrow", "by friday", "by tonight", "this weekend"
    ];
    const isCommitmentCandidate = commitmentTriggers.some(t => lower.includes(t));

    // 3. Profile Update Signal Check
    const profileTriggers = [
      '1st year', 'first year', 'freshman',
      '2nd year', 'second year', 'sophomore',
      '3rd year', 'third year', 'junior',
      '4th year', 'final year', 'senior',
      'graduated', 'college', 'university', 'student',
      'aspiring', 'want to be a', 'target role', 'looking for a role in'
    ];
    const isProfileUpdate = profileTriggers.some(t => lower.includes(t));

    // 4. Memory Candidate Signal Check
    const memoryTriggers = [
      'i prefer', 'i like', 'i enjoy', "i don't like", 'i hate', 'i struggle with',
      'my goal is', 'i am interested in', 'my skill', 'i know', 'my experience',
      'i learn best by', 'hands-on', 'video courses', 'project-based'
    ];
    const isMemoryCandidate = isProfileUpdate || memoryTriggers.some(t => lower.includes(t));

    // 5. Roadmap Update Signal Check
    const roadmapTriggers = [
      'roadmap', 'plan', 'schedule', '30-day', 'where to start', 'next step',
      'completed task', 'finished day', 'done with day', 'show my roadmap', 'my progress'
    ];
    const isRoadmapUpdate = roadmapTriggers.some(t => lower.includes(t));

    // 6. Mentor Question Signal Check
    const questionTriggers = [
      'what is', 'how to', 'how do i', 'can you explain', 'why does',
      'difference between', 'should i', 'what are', 'how can', '?', 'recommend'
    ];
    const isMentorQuestion = !isCasual && (questionTriggers.some(t => lower.includes(t)) || trimmed.endsWith('?'));

    // 7. Onboarding Response Signal Check
    const isOnboardingResponse = isProfileUpdate || isMemoryCandidate || lower.includes('studying') || lower.includes('hours') || lower.includes('experience');

    // Aggregate detected categories
    const categories: IntentType[] = [];
    if (isCasual) categories.push('CASUAL');
    if (isMentorQuestion) categories.push('NORMAL_CHAT');
    if (isOnboardingResponse) categories.push('ONBOARDING_RESPONSE');
    if (isMemoryCandidate) categories.push('PROFILE_UPDATE');
    if (isCommitmentCandidate) categories.push('COMMITMENT_REQUEST');
    if (isRoadmapUpdate) categories.push('ROADMAP_PROGRESS');
    if (isProfileUpdate) categories.push('PROFILE_UPDATE');

    if (categories.length === 0) {
      categories.push('UNKNOWN');
    }

    // Determine primary category
    let primaryCategory: IntentType = categories[0] || 'UNKNOWN';

    return {
      primaryCategory,
      categories,
      signals: {
        isCasual,
        isMentorQuestion,
        isOnboardingResponse,
        isMemoryCandidate,
        isCommitmentCandidate,
        isRoadmapUpdate,
        isProfileUpdate
      }
    };
  }
}
