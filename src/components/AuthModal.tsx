import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });
          if (error) throw error;

          const loggedUser: UserProfile = {
            id: data.user?.id || 'usr_' + Date.now(),
            name: data.user?.user_metadata?.name || email.split('@')[0] || 'Student',
            email: data.user?.email || email.trim(),
            selectedMentor: null,
            personality: 'FRIENDLY',
            createdAt: data.user?.created_at || new Date().toISOString()
          };
          onSuccess(loggedUser);
        } else {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                name: name.trim() || 'Student'
              }
            }
          });
          if (error) throw error;

          let userId = data.user?.id;
          if (!data.session) {
            const loginRes = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password
            });
            if (loginRes.data.user) {
              userId = loginRes.data.user.id;
            }
          }

          const newUser: UserProfile = {
            id: userId || 'usr_' + Date.now(),
            name: name.trim() || 'Student',
            email: email.trim(),
            selectedMentor: null,
            personality: 'FRIENDLY',
            createdAt: data.user?.created_at || new Date().toISOString()
          };
          onSuccess(newUser);
        }
      } else {
        throw new Error('Supabase client is not configured. Please check your VITE_SUPABASE_URL environment variables.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase client is not configured.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setErrorMsg(err.message || 'Google Sign-In failed. Please verify Google OAuth credentials in your Supabase dashboard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl border border-slate-200 p-6 md:p-8 relative shadow-2xl space-y-6">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-broski-yellow font-black text-xl mx-auto shadow-md">
            MB
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isLogin ? 'Welcome Back to Mentor Broski' : 'Create Your Account'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {isLogin ? 'Sign in to reconnect with your personal mentor' : 'Join ambitious students building real careers'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs transition-all flex items-center justify-center gap-3 min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[10px] uppercase font-extrabold text-slate-400 absolute">or email</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required={!isLogin}
                  placeholder="e.g. Alex Rivers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl btn-broski-primary text-sm flex items-center justify-center gap-2 group min-h-[44px] mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Sign In to Mentor Broski' : 'Continue to Mentor Selection'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500 font-medium">
          {isLogin ? "Don't have an account yet?" : "Already have an account?"}{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg(null);
            }}
            className="text-slate-900 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};
