import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OnboardingStep, MentorId, PersonalityStyle, UserProfile, DbMemoryRecord, ChatMessage } from '../types';
import { MENTORS } from '../data/mentors';
import { MemoryExtractor } from './memoryExtractor';
import { RetrievalService } from './retrievalService';

export interface StepConfig {
  step: OnboardingStep;
  nextStep: OnboardingStep;
  getQuestion: (mentorName: string, userName?: string, mentorId?: MentorId) => string;
  isAlreadyKnown: (profile: Partial<UserProfile> | null) => boolean;
  parseAndValidate: (userMessage: string) => { isValid: boolean; parsedValue?: any; clarificationQuestion?: string };
}

export class OnboardingManager {
  static STEPS_ORDER: OnboardingStep[] = [
    'ONBOARDING_NOT_STARTED',
    'GREETING_EXCHANGE',
    'ASK_NAME',
    'ASK_EDUCATION',
    'ASK_GOAL',
    'ASK_EXPERIENCE',
    'ASK_WEEKLY_HOURS',
    'ASK_LEARNING_STYLE',
    'ASK_INTERESTS',
    'ONBOARDING_COMPLETE'
  ];

  static getNaturalOpeningGreeting(mentorId: MentorId, personality: PersonalityStyle | null): string {
    const tone = personality || 'FRIENDLY';
    if (mentorId === 'ALEX') {
      if (tone === 'STRICT') {
        return `Welcome. I'm Alex. Good to connect. How are you doing today?`;
      } else if (tone === 'BUBBLY') {
        return `Hiiiii! 🛡️ I'm Alex! Super excited to meet you! How are you doing today? ✨`;
      } else {
        return `Hey! I'm Alex. Ready to explore cybersecurity with you. Good to meet you! How are you doing?`;
      }
    } else if (mentorId === 'LUCY') {
      if (tone === 'STRICT') {
        return `Welcome. I'm Lucy. Good to connect. How are you doing today?`;
      } else if (tone === 'BUBBLY') {
        return `Heyyy! 📊 I'm Lucy! So excited to meet you! How are you doing today? ✨`;
      } else {
        return `Hey! I'm Lucy. Good to meet you! How are you doing?`;
      }
    } else { // AARYA
      if (tone === 'STRICT') {
        return `Welcome. I'm Aarya. Good to connect. How are you doing today?`;
      } else if (tone === 'BUBBLY') {
        return `Hey hey! 🚀 I'm Aarya! So hyped to be your mentor! How are you doing today? ✨`;
      } else {
        return `Hey! I'm Aarya. Good to meet you! How are you doing?`;
      }
    }
  }

  static STEP_CONFIGS: Record<string, StepConfig> = {
    GREETING_EXCHANGE: {
      step: 'GREETING_EXCHANGE',
      nextStep: 'ASK_NAME',
      getQuestion: (mentorName, _, mentorId) => {
        return OnboardingManager.getNaturalOpeningGreeting(mentorId || 'AARYA', 'FRIENDLY');
      },
      isAlreadyKnown: (profile) => {
        return Boolean(
          profile?.onboardingStep &&
          profile.onboardingStep !== 'GREETING_EXCHANGE' &&
          profile.onboardingStep !== 'ONBOARDING_NOT_STARTED'
        );
      },
      parseAndValidate: (msg) => {
        return { isValid: true, parsedValue: msg.trim() };
      }
    },
    ASK_NAME: {
      step: 'ASK_NAME',
      nextStep: 'ASK_EDUCATION',
      getQuestion: (mentorName) =>
        `To get started: what's your full name so I know how to address you?`,
      isAlreadyKnown: (profile) => Boolean(profile?.name && profile.name !== 'Student'),
      parseAndValidate: (msg) => {
        const clean = msg.replace(/^(my name is|i am|i'm|call me|this is)\s+/i, '').trim();
        const lower = clean.toLowerCase();
        const nonNameWords = [
          'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'yes', 'no', 'ok', 'okay',
          'fine', 'good', 'great', 'thanks', 'thank you', 'how are you', 'what',
          'who', 'test', 'sure', 'yeah', 'yep', 'nope', 'cool', 'awesome'
        ];
        const isGreetingPhrase = /^(hi|hello|hey|yo|howdy)\s+/i.test(clean);
        if (
          clean.length < 2 ||
          clean.length > 50 ||
          nonNameWords.includes(lower) ||
          isGreetingPhrase ||
          lower.startsWith('how are') ||
          lower.startsWith('good ') ||
          lower.includes('thank') ||
          clean.endsWith('?')
        ) {
          return {
            isValid: false,
            clarificationQuestion: "Could you tell me just your name so I know how to address you?"
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    },
    ASK_EDUCATION: {
      step: 'ASK_EDUCATION',
      nextStep: 'ASK_GOAL',
      getQuestion: (_, userName) =>
        `Great to connect with you, ${userName || 'friend'}! What is your educational background, current year of study, or college? (e.g. 2nd Year CS, High School, Self-taught, Working professional)`,
      isAlreadyKnown: (profile) => Boolean(profile?.education || profile?.academicYear),
      parseAndValidate: (msg) => {
        const clean = msg.trim();
        const lower = clean.toLowerCase();
        const greetings = ['hi', 'hello', 'hey', 'ok', 'thanks', 'cool'];
        if (clean.length < 2 || greetings.includes(lower) || clean.endsWith('?')) {
          return {
            isValid: false,
            clarificationQuestion: "Could you share what you're currently studying, what year/grade you're in, or if you're working/self-taught?"
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    },
    ASK_GOAL: {
      step: 'ASK_GOAL',
      nextStep: 'ASK_EXPERIENCE',
      getQuestion: (_, __, mentorId) => {
        if (mentorId === 'ALEX') {
          return `Got it! Within cybersecurity, what specific target role or area are you aiming for? (e.g., SOC Analyst, Penetration Tester, Security Engineer, Cloud Security)`;
        } else if (mentorId === 'LUCY') {
          return `Got it! In data analytics, what specific target role are you aiming for? (e.g., Data Analyst, BI Developer, Data Scientist, Analytics Engineer)`;
        } else {
          return `Got it! In AI & Machine Learning, what specific target role are you aiming for? (e.g., AI/ML Engineer, Computer Vision, NLP Specialist, Full-Stack AI Developer)`;
        }
      },
      isAlreadyKnown: (profile) => Boolean(profile?.targetRole),
      parseAndValidate: (msg) => {
        const clean = msg.trim();
        if (clean.length < 3 || clean.endsWith('?')) {
          return {
            isValid: false,
            clarificationQuestion: "Which specific role or career direction would you like us to target?"
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    },
    ASK_EXPERIENCE: {
      step: 'ASK_EXPERIENCE',
      nextStep: 'ASK_WEEKLY_HOURS',
      getQuestion: () =>
        `How would you describe your current experience level in this field? Please choose one:\n\n• BEGINNER (Starting from scratch)\n• INTERMEDIATE (Know syntax & basic projects)\n• ADVANCED (Building production systems)\n• NOT_SURE (Exploring options)`,
      isAlreadyKnown: (profile) => Boolean(profile?.experienceLevel && profile.experienceLevel !== 'NOT_SURE'),
      parseAndValidate: (msg) => {
        const lower = msg.toLowerCase().trim();
        if (lower.includes('beginner') || lower.includes('scratch') || lower.includes('no experience') || lower.includes('newbie') || lower.includes('start')) {
          return { isValid: true, parsedValue: 'BEGINNER' };
        }
        if (lower.includes('intermediate') || lower.includes('moderate') || lower.includes('some experience') || lower.includes('basics down')) {
          return { isValid: true, parsedValue: 'INTERMEDIATE' };
        }
        if (lower.includes('advanced') || lower.includes('expert') || lower.includes('experienced') || lower.includes('senior')) {
          return { isValid: true, parsedValue: 'ADVANCED' };
        }
        if (lower.includes('not sure') || lower.includes('unsure') || lower.includes('dont know') || lower.includes("don't know")) {
          return { isValid: true, parsedValue: 'NOT_SURE' };
        }
        return {
          isValid: false,
          clarificationQuestion: "Are you starting as a BEGINNER, INTERMEDIATE, ADVANCED, or NOT_SURE? Let me know so we calibrate your roadmap correctly."
        };
      }
    },
    ASK_WEEKLY_HOURS: {
      step: 'ASK_WEEKLY_HOURS',
      nextStep: 'ASK_LEARNING_STYLE',
      getQuestion: () =>
        `Consistency is key! How many hours can you realistically dedicate to learning each week? (e.g., 5 hours/week, 10-15 hours, 2 hours/day)`,
      isAlreadyKnown: (profile) => Boolean(profile?.weeklyHours),
      parseAndValidate: (msg) => {
        const clean = msg.trim();
        if (clean.length < 1 || clean.endsWith('?')) {
          return {
            isValid: false,
            clarificationQuestion: "Approximately how many hours per week (or per day) can you set aside for study?"
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    },
    ASK_LEARNING_STYLE: {
      step: 'ASK_LEARNING_STYLE',
      nextStep: 'ASK_INTERESTS',
      getQuestion: () =>
        `Understood. How do you learn best? (e.g., Hands-on building projects, reading official docs & books, watching video tutorials, or practice labs)`,
      isAlreadyKnown: (profile) => Boolean(profile?.learningStyle),
      parseAndValidate: (msg) => {
        const clean = msg.trim();
        if (clean.length < 2 || clean.endsWith('?')) {
          return {
            isValid: false,
            clarificationQuestion: "Do you prefer building projects, reading documentation, watching videos, or solving hands-on labs?"
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    },
    ASK_INTERESTS: {
      step: 'ASK_INTERESTS',
      nextStep: 'ONBOARDING_COMPLETE',
      getQuestion: () =>
        `Almost done! What specific sub-topics, tech stacks, or dream project ideas excite you the most?`,
      isAlreadyKnown: (profile) => Boolean(profile?.interests),
      parseAndValidate: (msg) => {
        const clean = msg.trim();
        if (clean.length < 2 || clean.endsWith('?')) {
          return {
            isValid: false,
            clarificationQuestion: "Tell me what specific technologies or project ideas you find most interesting."
          };
        }
        return { isValid: true, parsedValue: clean };
      }
    }
  };

  /**
   * Called when chat mounts. Uses atomic DB lock (claim_first_mentor_initiation)
   * to guarantee the mentor greeting is initiated exactly once even under concurrent mounts.
   */
  static async checkAndTriggerMentorInitiatedOnboarding(params: {
    userId: string;
    conversationId: string;
    mentorId: MentorId;
    personality: PersonalityStyle | null;
    currentProfile: Partial<UserProfile> | null;
    recentMessagesCount: number;
  }): Promise<ChatMessage | null> {
    const { userId, conversationId, mentorId, personality, currentProfile } = params;
    if (!userId || !conversationId) return null;

    const mentor = MENTORS[mentorId] || MENTORS.AARYA;
    const currentStep: OnboardingStep = (currentProfile?.onboardingStep as OnboardingStep) || 'ONBOARDING_NOT_STARTED';
    const isCompleted = currentProfile?.onboardingCompleted || currentStep === 'ONBOARDING_COMPLETE';

    if (isCompleted) return null;

    if (isSupabaseConfigured && supabase) {
      // 1. Check atomic initiation lock table via RPC
      const { data: wasClaimed, error: claimErr } = await supabase.rpc('claim_first_mentor_initiation', {
        p_user_id: userId,
        p_mentor_id: mentorId,
        p_conversation_id: conversationId
      });

      // If already claimed by another concurrent mount, abort immediately
      if (!claimErr && wasClaimed === false) {
        return null;
      }

      // Check if messages already exist in DB
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

      if (count && count > 0) {
        return null;
      }
    }

    // Natural relationship-first opening: always begin with a warm mentor greeting!
    const initialGreeting = this.getNaturalOpeningGreeting(mentorId, personality);

    await this.updateOnboardingStepInDb(userId, 'GREETING_EXCHANGE', false);

    const mentorMsg = await RetrievalService.persistMessage(
      conversationId,
      userId,
      'mentor',
      initialGreeting
    );

    return mentorMsg;
  }

  /**
   * Process user's response to the active onboarding step with deterministic validation and clarification loops.
   */
  static async processOnboardingResponse(params: {
    userId: string;
    conversationId: string;
    mentorId: MentorId;
    userMessage: string;
    currentProfile: Partial<UserProfile> | null;
  }): Promise<{ mentorReply: string; nextStep: OnboardingStep; isComplete: boolean }> {
    const { userId, conversationId, mentorId, userMessage, currentProfile } = params;
    const mentor = MENTORS[mentorId] || MENTORS.AARYA;
    let currentStep: OnboardingStep = (currentProfile?.onboardingStep as OnboardingStep) || 'GREETING_EXCHANGE';

    // If currently in GREETING_EXCHANGE, find the first profiling step that is not yet completed
    if (currentStep === 'GREETING_EXCHANGE' || currentStep === 'ONBOARDING_NOT_STARTED') {
      let firstUnfinishedStep: OnboardingStep = 'ASK_NAME';
      for (const stepKey of this.STEPS_ORDER) {
        if (stepKey === 'ONBOARDING_NOT_STARTED' || stepKey === 'GREETING_EXCHANGE' || stepKey === 'ONBOARDING_COMPLETE') continue;
        const config = this.STEP_CONFIGS[stepKey];
        if (config && !config.isAlreadyKnown(currentProfile)) {
          firstUnfinishedStep = stepKey;
          break;
        }
      }

      await this.updateOnboardingStepInDb(userId, firstUnfinishedStep, false);
      const firstConfig = this.STEP_CONFIGS[firstUnfinishedStep];
      const reply = firstConfig
        ? `Awesome! Let's get to work. ${firstConfig.getQuestion(mentor.name, currentProfile?.name, mentorId)}`
        : "What's next?";

      return {
        mentorReply: reply,
        nextStep: firstUnfinishedStep,
        isComplete: false
      };
    }

    const stepConfig = this.STEP_CONFIGS[currentStep];

    if (!stepConfig) {
      return {
        mentorReply: "Your onboarding is complete! What would you like to build or learn next?",
        nextStep: 'ONBOARDING_COMPLETE',
        isComplete: true
      };
    }

    // 1. Deterministic Parser & Validator
    const validation = stepConfig.parseAndValidate(userMessage);
    if (!validation.isValid) {
      // Keep current step and request clarification
      return {
        mentorReply: validation.clarificationQuestion || `Could you clarify that for me? ${stepConfig.getQuestion(mentor.name, currentProfile?.name, mentorId)}`,
        nextStep: currentStep,
        isComplete: false
      };
    }

    // 2. Persist structured profile data in profiles table and context memories
    const parsedVal = validation.parsedValue;
    const profileUpdates: Record<string, any> = {};
    const memoriesToSave: { keyCategory: string; content: string }[] = [];

    if (currentStep === 'ASK_NAME') {
      profileUpdates.full_name = parsedVal;
      memoriesToSave.push({ keyCategory: 'user_name', content: parsedVal });
    } else if (currentStep === 'ASK_EDUCATION') {
      profileUpdates.education = parsedVal;
      profileUpdates.academic_year = parsedVal;
      memoriesToSave.push({ keyCategory: 'academic_situation', content: parsedVal });
    } else if (currentStep === 'ASK_GOAL') {
      profileUpdates.target_role = parsedVal;
      memoriesToSave.push({ keyCategory: 'career_goal', content: parsedVal });
    } else if (currentStep === 'ASK_EXPERIENCE') {
      profileUpdates.experience_level = parsedVal;
      memoriesToSave.push({ keyCategory: 'experience_level', content: parsedVal });
    } else if (currentStep === 'ASK_WEEKLY_HOURS') {
      profileUpdates.weekly_hours = parsedVal;
      memoriesToSave.push({ keyCategory: 'study_hours', content: parsedVal });
    } else if (currentStep === 'ASK_LEARNING_STYLE') {
      profileUpdates.learning_style = parsedVal;
      memoriesToSave.push({ keyCategory: 'learning_style', content: parsedVal });
    } else if (currentStep === 'ASK_INTERESTS') {
      profileUpdates.interests = parsedVal;
      memoriesToSave.push({ keyCategory: 'preferred_projects', content: parsedVal });
    }

    if (userId && isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update(profileUpdates).eq('user_id', userId);
      if (memoriesToSave.length > 0) {
        await MemoryExtractor.saveExtractedMemories(userId, memoriesToSave);
      }
    }

    // 3. Determine next step in sequence (skipping any step already known)
    let nextStep: OnboardingStep = 'ONBOARDING_COMPLETE';
    const currentIndex = this.STEPS_ORDER.indexOf(currentStep);

    // Merge in-flight update into profile view for step progression calculation
    const updatedProfileView: Partial<UserProfile> = {
      ...currentProfile,
      ...profileUpdates,
      name: profileUpdates.full_name || currentProfile?.name,
      education: profileUpdates.education || currentProfile?.education,
      targetRole: profileUpdates.target_role || currentProfile?.targetRole,
      experienceLevel: profileUpdates.experience_level || currentProfile?.experienceLevel,
      weeklyHours: profileUpdates.weekly_hours || currentProfile?.weeklyHours,
      learningStyle: profileUpdates.learning_style || currentProfile?.learningStyle,
      interests: profileUpdates.interests || currentProfile?.interests
    };

    for (let i = currentIndex + 1; i < this.STEPS_ORDER.length; i++) {
      const candidate = this.STEPS_ORDER[i];
      if (candidate === 'ONBOARDING_COMPLETE') {
        nextStep = 'ONBOARDING_COMPLETE';
        break;
      }
      const candidateConfig = this.STEP_CONFIGS[candidate];
      if (candidateConfig && !candidateConfig.isAlreadyKnown(updatedProfileView)) {
        nextStep = candidate;
        break;
      }
    }

    const isComplete = nextStep === 'ONBOARDING_COMPLETE';
    await this.updateOnboardingStepInDb(userId, nextStep, isComplete);

    let mentorReply = '';
    if (isComplete) {
      const studentName = updatedProfileView.name || 'Student';
      const targetRole = updatedProfileView.targetRole || 'your chosen field';
      const exp = updatedProfileView.experienceLevel || 'Beginner';
      mentorReply = `Awesome, ${studentName}! 🎉 I've got your profile dialed in:\n\n• Target Role: **${targetRole}**\n• Experience Level: **${exp}**\n• Commitment: **${updatedProfileView.weeklyHours || 'Regular focus'}**\n\nWhenever you're ready, let me know and we can outline a roadmap, discuss real project ideas, or dive into questions!`;
    } else {
      const nextConfig = this.STEP_CONFIGS[nextStep];
      mentorReply = nextConfig ? nextConfig.getQuestion(mentor.name, updatedProfileView.name, mentorId) : "What's next?";
    }

    return { mentorReply, nextStep, isComplete };
  }

  static async updateOnboardingStepInDb(userId: string, step: OnboardingStep, completed: boolean): Promise<void> {
    if (!userId || !isSupabaseConfigured || !supabase) return;
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_step: step,
          onboarding_completed: completed,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } catch (err) {
      console.error('Error updating onboarding step in Supabase:', err);
    }
  }
}
