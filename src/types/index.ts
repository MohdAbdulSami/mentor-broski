export type MentorId = 'AARYA' | 'ALEX' | 'LUCY';

export type MentorDomain = 'AI_ML' | 'CYBERSECURITY' | 'DATA_SCIENCE';

export type PersonalityStyle = 'FRIENDLY' | 'STRICT' | 'BUBBLY';

export type ActiveTab = 'HOME' | 'MENTOR' | 'ROADMAP' | 'TODAY' | 'PROGRESS' | 'PROFILE';

export type OnboardingStep =
  | 'ONBOARDING_NOT_STARTED'
  | 'GREETING_EXCHANGE'
  | 'ASK_NAME'
  | 'ASK_EDUCATION'
  | 'ASK_GOAL'
  | 'ASK_EXPERIENCE'
  | 'ASK_WEEKLY_HOURS'
  | 'ASK_LEARNING_STYLE'
  | 'ASK_INTERESTS'
  | 'ONBOARDING_COMPLETE';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  selectedMentor: MentorId | null;
  personality: PersonalityStyle | null;
  academicYear?: string;
  education?: string;
  targetRole?: string;
  experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'NOT_SURE';
  weeklyHours?: string;
  learningStyle?: string;
  interests?: string;
  preferredStudyWindow?: string;
  onboardingStep?: OnboardingStep;
  onboardingCompleted?: boolean;
  displayName?: string;
  lastUserActivityAt?: string;
  lastProactiveCheckinAt?: string;
  nextProactiveCheckinAt?: string;
  engagementStatus?: 'ACTIVE' | 'INACTIVE' | 'CHECKED_IN';
  createdAt: string;
}

export interface MentorDefinition {
  id: MentorId;
  name: string;
  domain: MentorDomain;
  subjectBadge: string;
  tagline: string;
  bio: string;
  profileQuote: string;
  avatar: string;
  accentColor: string;
  expertiseList: string[];
  initialGreetings: Record<PersonalityStyle, string>;
}

export interface PersonalityDefinition {
  style: PersonalityStyle;
  title: string;
  badge: string;
  description: string;
  toneSummary: string;
  sampleQuote: string;
}

export interface ResourceLink {
  title: string;
  type: 'Doc' | 'Course' | 'Video' | 'Practice' | 'Project' | 'Article';
  url: string;
  description: string;
  whyRecommended: string;
}

export interface ActionItem {
  id: string;
  day: number;
  title: string;
  goal: string;
  learnTopic: string;
  recommendedResources: ResourceLink[];
  practiceTask: string;
  buildProject: string;
  successCondition?: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface StageRoadmap {
  stageNumber: number;
  stageTitle: string;
  description: string;
  durationDays: number;
  tasks: ActionItem[];
}

export interface RoadmapPlan {
  mentorId: MentorId;
  domain: MentorDomain;
  createdDate: string;
  title: string;
  summary: string;
  currentDay: number;
  stages: StageRoadmap[];
}

export interface Commitment {
  id: string;
  statement: string;
  targetWindow: string;
  status: 'PENDING' | 'MET' | 'MISSED' | 'EXCUSED';
  verifiedAt?: string;
  createdAt: string;
  conversationId?: string;
  dueAt?: string;
  notificationStatus?: 'PENDING' | 'DELIVERED' | 'FAILED';
}

export interface UserMemory {
  academicSituation?: string;
  currentSkills?: string[];
  careerGoal?: string;
  timeline?: string;
  motivation?: string;
  currentObstacles?: string;
  preferredLearningWindow?: string;
  behavioralPatterns?: string[];
  commitments?: Commitment[];
  completedMilestones?: string[];
  lastUpdated: string;
}

export interface ChatMessage {
  id: string;
  sender: 'mentor' | 'user' | 'system';
  text: string;
  timestamp: string;
  resources?: ResourceLink[];
  suggestPlanTrigger?: boolean;
  isProactiveCheckIn?: boolean;
}

export interface ScheduledBackendAction {
  id: string;
  userId: string;
  mentorId: MentorId;
  type: 'MENTOR_CHECK_IN' | 'COMMITMENT_REMINDER' | 'TASK_REMINDER' | 'PROGRESS_CHECK';
  scheduledFor: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  createdAt: string;
}

export interface AnalyticsEvent {
  eventName: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type IntentType =
  | 'CASUAL'
  | 'ONBOARDING_RESPONSE'
  | 'ROADMAP_REQUEST'
  | 'COMMITMENT_REQUEST'
  | 'COMMITMENT_ACKNOWLEDGEMENT'
  | 'COMMITMENT_SNOOZE'
  | 'COMMITMENT_COMPLETION'
  | 'PROFILE_UPDATE'
  | 'ROADMAP_PROGRESS'
  | 'QUIZ_REQUEST'
  | 'NORMAL_CHAT'
  | 'PROACTIVE_CHECKIN_RESPONSE'
  | 'PROGRESSION_CONTINUE'
  | 'PROGRESSION_TOMORROW'
  | 'UNKNOWN';

export type MessageCategory = IntentType;

export interface ClassificationResult {
  primaryCategory: IntentType;
  categories: IntentType[];
  signals: {
    isCasual: boolean;
    isMentorQuestion: boolean;
    isOnboardingResponse: boolean;
    isMemoryCandidate: boolean;
    isCommitmentCandidate: boolean;
    isRoadmapUpdate: boolean;
    isProfileUpdate: boolean;
  };
}

export interface DbMemoryRecord {
  id: string;
  user_id: string;
  key_category: string;
  content: string;
  created_at: string;
}

export type CommitmentStatus =
  | 'PENDING'
  | 'REMINDING'
  | 'IN_PROGRESS'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'MET'
  | 'MISSED'
  | 'EXCUSED'
  | 'CANCELLED';

export interface DbCommitmentRecord {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  source_message_id?: string | null;
  statement: string;
  action?: string | null;
  context?: string | null;
  roadmap_id?: string | null;
  roadmap_day?: number | null;
  target_window?: string | null;
  due_at?: string | null;
  timezone?: string | null;
  status: CommitmentStatus;
  reminder_interval_minutes?: number | null;
  next_reminder_at?: string | null;
  last_reminded_at?: string | null;
  reminder_count?: number | null;
  escalation_level?: number | null;
  notification_status?: 'PENDING' | 'DELIVERED' | 'FAILED';
  acknowledged_at?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface DbQuizRecord {
  id: string;
  roadmap_id: string;
  day_number: number;
  topic: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface DbQuizAttemptRecord {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  passed: boolean;
  answers: number[];
  created_at: string;
}

export interface DbRoadmapRecord {
  id: string;
  user_id: string;
  domain: string;
  title: string;
  summary?: string | null;
  current_day: number;
  stages: StageRoadmap[];
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  created_at: string;
}

export interface LLMContextObject {
  userProfile: {
    id?: string;
    fullName?: string;
    email?: string;
    academicYear?: string;
    education?: string;
    targetRole?: string;
    experienceLevel?: string;
    weeklyHours?: string;
    learningStyle?: string;
    interests?: string;
    activeMentorId?: string | null;
    personality?: string | null;
  };
  relevantMemories: Array<{ category: string; content: string }>;
  activeCommitments: Array<{ statement: string; targetWindow?: string | null }>;
  roadmapState?: { id?: string; domain?: string; title: string; currentDay: number; activeStageTitle?: string };
  recentMessages: Array<{ sender: 'user' | 'mentor' | 'system'; text: string; timestamp?: string }>;
  currentMessage: string;
  classificationSignals: MessageCategory[];
  onboardingState?: { isComplete: boolean; currentTopicKey?: string; promptQuestion?: string };
}

export interface QuizQuestionDetail {
  question_index: number;
  question: string;
  options: string[];
  user_answer_index: number;
  user_answer_text: string;
  correct_answer_index: number;
  correct_answer_text: string;
  is_correct: boolean;
  explanation: string;
}

export interface QuizSubmissionResult {
  attempt_id?: string;
  score: number;
  passed: boolean;
  total_count: number;
  correct_count: number;
  details: QuizQuestionDetail[];
  has_quiz?: boolean;
  has_attempt?: boolean;
  quiz_id?: string;
  day_number?: number;
  topic?: string;
}


