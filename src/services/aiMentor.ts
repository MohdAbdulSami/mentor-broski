import { MentorId, MentorDomain, PersonalityStyle, UserMemory, ChatMessage, ResourceLink, RoadmapPlan } from '../types';
import { MENTORS, PERSONALITIES } from '../data/mentors';
import { CommitmentStore } from './commitmentStore';
import { SchedulerService } from './scheduler';

/**
 * Obsolete browser API key accessor.
 * GEMINI_API_KEY is stored exclusively in Supabase Edge Function Secrets, never in browser.
 */
export function getApiKey(): string | null {
  return null;
}

export function setApiKey(_key: string): void {
  // Purge any legacy browser storage
  try {
    localStorage.removeItem('mentorbroski_api_key');
  } catch {}
}

export function compileSystemPrompt(
  mentorId: MentorId,
  personality: PersonalityStyle,
  memory: UserMemory
): string {
  const mentor = MENTORS[mentorId];

  const pendingCommitments = CommitmentStore.getPendingCommitments();
  const commitmentsSummary = pendingCommitments.length > 0
    ? pendingCommitments.map(c => `- Promised: "${c.statement}" (Window: ${c.targetWindow})`).join('\n')
    : 'No active commitments pending.';

  return `ROLE: You are ${mentor.name}, a personal career mentor.
DOMAIN: ${mentor.tagline} (${mentor.domain}). Profile: "${mentor.bio}"
PERSONALITY: ${personality}.

USER CONTEXT:
- Academic Situation: ${memory.academicSituation || 'Not specified'}
- Known Skills: ${memory.currentSkills?.length ? memory.currentSkills.join(', ') : 'None logged yet'}
- Target Career Goal: ${memory.careerGoal || 'Exploring options'}
- Preferred Study Schedule: ${memory.preferredLearningWindow || 'Flexible'}
- Current Obstacle: ${memory.currentObstacles || 'None specified'}
- Pending Commitments:
${commitmentsSummary}

BEHAVIOR RULES:
1. Speak naturally as ${mentor.name}. Prioritize continuity over generic advice.
2. Understand before advising. Ask diagnostic questions when context is missing.
3. Answer direct technical questions directly without forcing a roadmap.
4. If user states they missed a task ("I didn't finish it"), ask "What stopped you?" and adapt.
5. NEVER fabricate memory. If context is missing, do NOT say "As you told me last week...", ask the student directly.

PERSONALITY TONE (${personality}):
- Friendly: Warm, patient, supportive, conversational.
- Strict: Direct, honest, accountable, firm without being insulting or abusive.
- Bubbly: Energetic, casual, playful, light humor.`;
}

export async function generateMentorResponse(
  userMessage: string,
  history: ChatMessage[],
  mentorId: MentorId,
  personality: PersonalityStyle,
  memory: UserMemory
): Promise<{ text: string; resources?: ResourceLink[]; suggestPlanTrigger?: boolean }> {
  const apiKey = getApiKey();
  const startTime = Date.now();

  // Reset anti-spam counter when user responds
  SchedulerService.onUserResponded();

  const newCommitment = CommitmentStore.extractCommitmentFromMessage(userMessage);
  if (newCommitment) {
    CommitmentStore.addCommitment(newCommitment);
    // Schedule deterministic commitment check-in
    SchedulerService.scheduleCommitmentCheckIn(
      'user',
      mentorId,
      newCommitment.id,
      newCommitment.statement,
      new Date(Date.now() + 86400000).toISOString()
    );
  }

  // Primary routing is handled via ChatOrchestrator -> LLMResponseService -> Gemini Edge Function.
  // Legacy direct caller routes to deterministic fallback router.
  return generateFallbackResponse(userMessage, mentorId, personality, memory);
}

function textRequestsPlan(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('roadmap') ||
    text.includes('plan') ||
    text.includes('schedule') ||
    text.includes('30-day') ||
    text.includes('where to start')
  );
}

function parseResourcesFromText(text: string, domain: MentorDomain): ResourceLink[] | undefined {
  if (text.includes('http') || text.includes('Resource') || text.includes('Documentation')) {
    return getDomainResources(domain).slice(0, 3);
  }
  return undefined;
}

function getDomainResources(domain: MentorDomain): ResourceLink[] {
  if (domain === 'AI_ML') {
    return [
      {
        title: 'Python for AI & Data Science Documentation',
        type: 'Doc',
        url: 'https://docs.python.org/3/tutorial/',
        description: 'Official Python docs covering data structures and standard library.',
        whyRecommended: 'Essential for writing clean, bug-free Machine Learning scripts.'
      },
      {
        title: 'Fast.ai Practical Deep Learning for Coders',
        type: 'Course',
        url: 'https://course.fast.ai/',
        description: 'Top-tier free hands-on deep learning course built on PyTorch.',
        whyRecommended: 'Focuses on top-down implementation before deep math.'
      }
    ];
  } else if (domain === 'CYBERSECURITY') {
    return [
      {
        title: 'TryHackMe Pre-Security Path',
        type: 'Practice',
        url: 'https://tryhackme.com/path/outline/presecurity',
        description: 'Interactive browser-based labs for networking and Linux fundamentals.',
        whyRecommended: 'Hands-on virtual machine labs without complex local setup.'
      }
    ];
  } else {
    return [
      {
        title: 'Mode Analytics SQL Tutorial for Data Analysis',
        type: 'Course',
        url: 'https://mode.com/sql-tutorial/',
        description: 'Interactive SQL guide covering SELECTs, JOINs, and window functions.',
        whyRecommended: 'Uses real SQL syntax against actual business datasets.'
      }
    ];
  }
}

// Section 32 & 60: Deterministic Template Fallback Router
function generateFallbackResponse(
  userMessage: string,
  mentorId: MentorId,
  personality: PersonalityStyle,
  memory: UserMemory
): { text: string; resources?: ResourceLink[]; suggestPlanTrigger?: boolean } {
  const text = userMessage.toLowerCase();
  const mentor = MENTORS[mentorId];

  let replyText = '';
  let resources: ResourceLink[] | undefined = undefined;
  const isPlanRequested = textRequestsPlan(userMessage);

  if (text.includes("didn't complete") || text.includes("didn't finish") || text.includes("couldn't do it")) {
    if (personality === 'STRICT') {
      replyText = `Understood. You didn't finish it.

I need to know: **What stopped you?**

1. **Time** (College exams / heavy workload)
2. **Difficulty** (Got stuck on code)
3. **Motivation / Focus**
4. **Task was too large**

Tell me straight so we can fix today's focus.`;
    } else if (personality === 'BUBBLY') {
      replyText = `Aw, no worries at all! It happens! 💖

Before we reset: **What got in the way?** 

Was it college exams, a confusing resource, or was the task just way too huge? Tell me and we'll fix it! ✨`;
    } else {
      replyText = `Thanks for telling me directly! That's totally okay.

To help me adjust today's plan: **What stopped you?**

- Was it time availability?
- Did you get stuck on a difficult topic?
- Or was the task simply too large?

Let me know so we can tweak our approach.`;
    }
  } else if (text.includes("overfitting") || text.includes("what is") || text.includes("difference between")) {
    replyText = `Here's the direct answer for ${userMessage}:

Overfitting happens when a machine learning model learns the noise and exact details of the training data too well, failing to generalize to new, unseen test data.

Think of it like memorizing answers for a specific practice exam instead of understanding the underlying concepts.

If you want to explore regularization techniques to fix it, let me know!`;
  } else if (isPlanRequested) {
    replyText = `That makes total sense! Having a structured step-by-step plan removes all the guesswork.

Based on your current background (${memory.academicSituation || 'student'}), I've built a **Living 30-Day Roadmap** focusing on small daily milestones.

Click the **"Living Roadmap"** button to inspect **TODAY's Action Item**!`;
    resources = getDomainResources(mentor.domain);
  } else {
    if (personality === 'STRICT') {
      replyText = `Got it. Noted in your profile.

What is your single biggest bottleneck right now? Is it finding quality resources, building real projects, or time management?`;
    } else if (personality === 'BUBBLY') {
      replyText = `Awesome! I've updated my notes about you! 📝

What's the #1 goal you want us to tackle first? Projects, study schedules, or interview prep?`;
    } else {
      replyText = `That's really helpful context! I've updated your mentor notes so we stay aligned as you progress.

What would be most helpful next?
1. Creating a practical **30-day roadmap**
2. Recommending **free resources** for your focus
3. Discussing **portfolio project ideas** that stand out to recruiters`;
    }
  }

  return {
    text: replyText,
    resources,
    suggestPlanTrigger: isPlanRequested
  };
}

export function generateInitialRoadmap(domain: MentorDomain): RoadmapPlan {
  const isAI = domain === 'AI_ML';
  const isCyber = domain === 'CYBERSECURITY';
  const mentorId = isAI ? 'AARYA' : isCyber ? 'ALEX' : 'LUCY';

  return {
    mentorId,
    domain,
    createdDate: new Date().toLocaleDateString(),
    title: isAI ? '30-Day AI/ML Internship Readiness Plan' : isCyber ? '30-Day Cybersecurity Foundations & Lab Plan' : '30-Day Data Analytics Portfolio Roadmap',
    summary: 'A living, adaptive roadmap designed to take you from foundational concepts to building real-world projects.',
    currentDay: 1,
    stages: [
      {
        stageNumber: 1,
        stageTitle: 'Phase 1: Core Foundations & Setup',
        description: 'Master core tools and environment setup.',
        durationDays: 7,
        tasks: [
          {
            id: 'task-1',
            day: 1,
            title: isAI ? 'Day 1 — Python & Data Structures Review' : isCyber ? 'Day 1 — Linux Terminal Mastery & File Permissions' : 'Day 1 — SQL Fundamentals & SELECT Queries',
            goal: isAI ? 'Understand Python lists, dicts, comprehensions, and functions for data processing.' : isCyber ? 'Master essential Linux CLI commands (cd, ls, grep, chmod, find, ssh).' : 'Master basic SQL querying, filtering (WHERE), sorting (ORDER BY), and aggregations.',
            learnTopic: isAI ? 'Python Data Structures & Functional Programming' : isCyber ? 'Linux Command Line Interface & Shell Scripting' : 'SQL SELECT, WHERE, GROUP BY, HAVING',
            recommendedResources: getDomainResources(domain),
            practiceTask: isAI ? 'Solve 3 Python array/string problems on HackerRank' : isCyber ? 'Complete Bandit Levels 0-5 on OverTheWire' : 'Complete 5 SQL queries on LeetCode SQL 50',
            buildProject: isAI ? 'Build a command-line student grade & metric analyzer script' : isCyber ? 'Write a simple Bash script to audit system users and running processes' : 'Query a sample CSV database and calculate top performing product categories',
            successCondition: 'Write the project script without following a tutorial.',
            estimatedMinutes: 60,
            completed: false
          }
        ]
      }
    ]
  };
}
