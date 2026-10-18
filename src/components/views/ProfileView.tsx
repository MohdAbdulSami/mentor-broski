import React, { useState } from 'react';
import { User, Bell, LogOut, Sparkles } from 'lucide-react';
import { UserProfile, MentorId, PersonalityStyle } from '../../types';
import { MENTORS, PERSONALITIES } from '../../data/mentors';
import { PushNotificationService } from '../../services/pushNotifications';
import { isSupabaseConfigured } from '../../lib/supabase';

interface ProfileViewProps {
  user: UserProfile;
  domain: string;
  personality: PersonalityStyle;
  onChangeMentor: () => void;
  onChangePersonality: () => void;
  onSignOut?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  personality,
  onChangeMentor,
  onChangePersonality,
  onSignOut
}) => {
  const selectedMentorId: MentorId = user.selectedMentor || 'AARYA';
  const mentor = MENTORS[selectedMentorId];
  const pers = PERSONALITIES[personality];

  const [pushStatus, setPushStatus] = useState<string>(
    'Notification' in window ? Notification.permission : 'not_supported'
  );

  const [pushSaving, setPushSaving] = useState<boolean>(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const handleRequestPush = async () => {
    setPushSaving(true);
    setPushError(null);
    try {
      const registered = await PushNotificationService.requestAndRegisterSubscription(user.id);
      if (registered) {
        setPushStatus('granted');
        PushNotificationService.sendNotification(
          user.id,
          mentor.id,
          'Mentor Broski Notifications Active! 🔔',
          `Your mentor ${mentor.name} (${personality} mode) will send you smart check-ins.`
        );
      } else {
        const currentPerm = 'Notification' in window ? Notification.permission : 'not_supported';
        setPushStatus(currentPerm);
        if (currentPerm === 'denied') {
          setPushError('Notifications blocked. Please enable them in your browser settings and try again.');
        } else {
          setPushError('Could not register for push notifications. Ensure you are on HTTPS and try again.');
        }
      }
    } catch (err: any) {
      setPushError(err?.message || 'Unexpected error enabling notifications.');
    } finally {
      setPushSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-24 md:pb-12 text-slate-900 bg-white">
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Profile & Settings</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage your account, active mentor preferences, and notification settings.</p>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold text-xs transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="social-card p-6 rounded-2xl space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <User className="w-5 h-5 text-slate-900" /> Account Profile
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs font-medium">
            <div>
              <span className="text-slate-400 uppercase text-[10px] font-bold block">Name</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{user.name}</p>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="text-slate-400 uppercase text-[10px] font-bold block">Email</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Mentor Configuration */}
        <div className="social-card p-6 rounded-2xl space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-900" /> Mentor & Tone Setup
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Active Mentor</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{mentor.name} ({mentor.subjectBadge})</p>
              </div>
              <button
                onClick={onChangeMentor}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 font-bold min-h-[44px]"
              >
                Change Mentor
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Personality Tone</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{pers.title} Tone</p>
              </div>
              <button
                onClick={onChangePersonality}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 font-bold min-h-[44px]"
              >
                Change Tone
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="social-card p-6 rounded-2xl space-y-4">
        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <Bell className="w-5 h-5 text-slate-900" /> Notifications & Proactive Check-ins
        </h3>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-400 uppercase text-[10px] font-bold block">Browser Push Status</span>
              <p className={`font-bold text-sm capitalize mt-0.5 ${pushStatus === 'granted' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {pushStatus === 'granted' ? '✓ Enabled' : pushStatus}
              </p>
            </div>

            {pushStatus !== 'granted' && (
              <button
                onClick={handleRequestPush}
                disabled={pushSaving}
                className="px-4 py-2 rounded-xl btn-broski-primary text-xs font-bold min-h-[44px] disabled:opacity-60 flex items-center gap-2"
              >
                {pushSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin inline-block" />
                    Enabling...
                  </>
                ) : (
                  'Enable Push Notifications'
                )}
              </button>
            )}
          </div>

          {pushError && (
            <p className="text-[11px] text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg p-2">
              ⚠️ {pushError}
            </p>
          )}

          <p className="text-[11px] text-slate-600 leading-relaxed pt-2 border-t border-slate-200 font-medium">
            Receives proactive mentor check-ins on Chrome desktop, Android PWA, and iOS Home Screen web apps.
          </p>
        </div>
      </div>
    </div>
  );
};
