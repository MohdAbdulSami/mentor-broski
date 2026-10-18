-- Supabase PostgreSQL Schema for Pathfinder AI Career Mentor
-- Migration: 20260922000000_init_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    academic_year TEXT,
    target_role TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Mentor Profiles
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL CHECK (domain IN ('AI_ML', 'CYBERSECURITY', 'DATA_SCIENCE')),
    title TEXT NOT NULL,
    description TEXT,
    expertise_topics TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Mentor Preferences
CREATE TABLE IF NOT EXISTS public.mentor_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    domain TEXT NOT NULL CHECK (domain IN ('AI_ML', 'CYBERSECURITY', 'DATA_SCIENCE')),
    personality TEXT NOT NULL CHECK (personality IN ('FRIENDLY', 'STRICT', 'BUBBLY')),
    preferred_study_window TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 4. Goals
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    personality TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'mentor', 'system')),
    text TEXT NOT NULL,
    resources JSONB,
    actions JSONB,
    is_proactive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Memories
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    key_category TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence SCORE FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Commitments
CREATE TABLE IF NOT EXISTS public.commitments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    target_window TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MET', 'MISSED', 'EXCUSED')),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Roadmaps
CREATE TABLE IF NOT EXISTS public.roadmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    current_day INT DEFAULT 1,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Roadmap Phases
CREATE TABLE IF NOT EXISTS public.roadmap_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_id UUID REFERENCES public.roadmaps(id) ON DELETE CASCADE,
    phase_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration_days INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    phase_id UUID REFERENCES public.roadmap_phases(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    learn_topic TEXT NOT NULL,
    practice_task TEXT NOT NULL,
    build_project TEXT NOT NULL,
    success_condition TEXT,
    estimated_minutes INT DEFAULT 60,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Resources
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    provider TEXT,
    type TEXT NOT NULL CHECK (type IN ('Doc', 'Course', 'Video', 'Practice', 'Project', 'Article')),
    difficulty TEXT DEFAULT 'Beginner',
    topic TEXT NOT NULL,
    estimated_time TEXT,
    description TEXT,
    why_recommended TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Progress
CREATE TABLE IF NOT EXISTS public.progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    days_active INT DEFAULT 1,
    tasks_completed INT DEFAULT 0,
    current_phase TEXT,
    recent_achievements TEXT[],
    areas_needing_attention TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Notifications & Scheduling
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('MORNING_PLAN', 'PROGRESS_CHECK', 'COMMITMENT_CHECK', 'MISSED_TASK', 'WEEKLY_REVIEW', 'MILESTONE')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    deep_link TEXT,
    read BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- 16. AI Run Logs (Cost Control)
CREATE TABLE IF NOT EXISTS public.ai_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    request_type TEXT NOT NULL,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,
    status TEXT DEFAULT 'SUCCESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Audit Logs & Analytics
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY (RLS) FOR ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES (USER ISOLATION)
CREATE POLICY "Users access own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own preferences" ON public.mentor_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own messages" ON public.messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own memories" ON public.memories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own commitments" ON public.commitments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own roadmaps" ON public.roadmaps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own progress" ON public.progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own push subs" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
