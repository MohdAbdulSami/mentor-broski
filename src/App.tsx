import React, { useState, useEffect } from 'react';
import { UserProfile, MentorId, PersonalityStyle } from './types';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { MentorSelector } from './components/MentorSelector';
import { PersonalitySelector } from './components/PersonalitySelector';
import { InboxLayout } from './components/InboxLayout';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { resolveMentor } from './data/mentors';
import { supabase, isSupabaseConfigured } from './lib/supabase';

type AppFlow = 'LANDING' | 'MENTOR_SELECT' | 'PERSONALITY_SELECT' | 'INBOX';

export function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mentorbroski_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedMentorId, setSelectedMentorId] = useState<MentorId | null>(() => {
    try {
      const savedUser = localStorage.getItem('mentorbroski_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.selectedMentor) {
          const m = resolveMentor(parsed.selectedMentor);
          return m ? m.id : null;
        }
      }
    } catch {}
    return null;
  });

  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityStyle | null>(() => {
    try {
      const savedUser = localStorage.getItem('mentorbroski_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return parsed?.personality || null;
      }
    } catch {}
    return null;
  });

  const [flow, setFlow] = useState<AppFlow>(() => {
    if (user && selectedMentorId) return 'INBOX';
    if (user) return 'MENTOR_SELECT';
    return 'LANDING';
  });

  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

  // Sync profile data from Supabase DB
  const syncProfileData = async (sessionUser: any) => {
    if (!supabase) {
      setIsProfileLoading(false);
      return;
    }
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (profile) {
        // Read exact DB values, DO NOT convert null to 'AARYA' or 'FRIENDLY'
        const activeMentor = profile.active_mentor_id ? resolveMentor(profile.active_mentor_id)?.id || null : null;
        const activePersonality = (profile.personality as PersonalityStyle) || null;

        setSelectedMentorId(activeMentor);
        setSelectedPersonality(activePersonality);

        const loadedUser: UserProfile = {
          id: sessionUser.id,
          name: profile.full_name || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Student',
          email: sessionUser.email || profile.email,
          selectedMentor: activeMentor,
          personality: activePersonality,
          // Load all persisted profile fields so onboarding never re-asks known information
          academicYear: profile.academic_year || undefined,
          education: profile.education || undefined,
          targetRole: profile.target_role || undefined,
          experienceLevel: profile.experience_level || undefined,
          weeklyHours: profile.weekly_hours || undefined,
          learningStyle: profile.learning_style || undefined,
          interests: profile.interests || undefined,
          onboardingStep: (profile.onboarding_step as any) || undefined,
          onboardingCompleted: profile.onboarding_completed || false,
          createdAt: sessionUser.created_at
        };
        setUser(loadedUser);

        if (activeMentor) {
          setFlow('INBOX');
        } else {
          setFlow('MENTOR_SELECT');
        }
      } else {
        // First time user: safely upsert profile record with onConflict: 'user_id'
        await supabase
          .from('profiles')
          .upsert({
            user_id: sessionUser.id,
            email: sessionUser.email || 'student@mentorbroski.com',
            full_name: sessionUser.user_metadata?.name || 'Student',
            active_mentor_id: null,
            personality: null
          }, { onConflict: 'user_id' });

        setSelectedMentorId(null);
        setSelectedPersonality(null);
        const loadedUser: UserProfile = {
          id: sessionUser.id,
          name: sessionUser.user_metadata?.name || 'Student',
          email: sessionUser.email || '',
          selectedMentor: null,
          personality: null,
          createdAt: sessionUser.created_at
        };
        setUser(loadedUser);
        setFlow('MENTOR_SELECT');
      }
    } catch (err) {
      console.error('Error loading profile from Supabase:', err);
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Sync session with Supabase Auth listener
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          syncProfileData(session.user);
        } else {
          setIsProfileLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          syncProfileData(session.user);
        } else if (_event === 'SIGNED_OUT') {
          setUser(null);
          setSelectedMentorId(null);
          setSelectedPersonality(null);
          localStorage.removeItem('mentorbroski_user');
          setFlow('LANDING');
          setIsProfileLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('mentorbroski_user', JSON.stringify({
          ...user,
          selectedMentor: selectedMentorId,
          personality: selectedPersonality
        }));
      } catch (err) {
        console.error('Failed to save local user cache:', err);
      }
    }
  }, [user, selectedMentorId, selectedPersonality]);

  const handleStartFlow = (mentorId?: MentorId) => {
    if (mentorId) {
      const validMentor = resolveMentor(mentorId);
      if (validMentor) setSelectedMentorId(validMentor.id);
    }
    if (!user) {
      setIsAuthOpen(true);
    } else if (mentorId || selectedMentorId) {
      setFlow('PERSONALITY_SELECT');
    } else {
      setFlow('MENTOR_SELECT');
    }
  };

  const handleAuthSuccess = (loggedUser: UserProfile) => {
    setUser(loggedUser);
    setIsAuthOpen(false);
    if (selectedMentorId) {
      setFlow('INBOX');
    } else {
      setFlow('MENTOR_SELECT');
    }
  };

  const handleSelectMentor = async (mentorId: MentorId) => {
    const safeMentor = resolveMentor(mentorId);
    if (!safeMentor) return;
    setSelectedMentorId(safeMentor.id);

    if (user) {
      setUser({ ...user, selectedMentor: safeMentor.id });
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('profiles')
            .update({ active_mentor_id: safeMentor.id })
            .eq('user_id', user.id);
        } catch (err) {
          console.error('Failed to update active_mentor_id in Supabase:', err);
        }
      }
    }
    setFlow('PERSONALITY_SELECT');
  };

  const handleSelectPersonality = async (style: PersonalityStyle) => {
    setSelectedPersonality(style);
    if (user) {
      setUser({ ...user, personality: style });
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('profiles')
            .update({ personality: style })
            .eq('user_id', user.id);
        } catch (err) {
          console.error('Failed to update personality in Supabase:', err);
        }
      }
    }
    setFlow('INBOX');
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSelectedMentorId(null);
    setSelectedPersonality(null);
    localStorage.removeItem('mentorbroski_user');
    setFlow('LANDING');
  };

  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-broski-yellow font-black text-xl mb-4 shadow-lg animate-bounce">
          MB
        </div>
        <p className="text-slate-600 font-bold text-sm">Loading Mentor Broski...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-900 selection:text-broski-yellow font-sans flex flex-col">
      {flow === 'LANDING' && (
        <LandingPage onStart={handleStartFlow} />
      )}

      {flow === 'MENTOR_SELECT' && (
        <MentorSelector
          selectedMentorId={selectedMentorId}
          onSelectMentor={handleSelectMentor}
        />
      )}

      {flow === 'PERSONALITY_SELECT' && selectedMentorId && (
        <PersonalitySelector
          selectedMentorId={selectedMentorId}
          selectedPersonality={selectedPersonality}
          onSelectPersonality={handleSelectPersonality}
          onBack={() => setFlow('MENTOR_SELECT')}
        />
      )}

      {flow === 'INBOX' && user && selectedMentorId && (
        <InboxLayout
          user={user}
          selectedMentorId={selectedMentorId}
          personality={selectedPersonality || 'FRIENDLY'}
          onSelectMentor={handleSelectMentor}
          onChangePersonality={() => setFlow('PERSONALITY_SELECT')}
          onSignOut={handleSignOut}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* PWA Installation Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
