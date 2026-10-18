import React from 'react';
import { X, Lock, Sparkles, Check, ArrowRight } from 'lucide-react';
import { MentorDefinition } from '../types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mentor?: MentorDefinition | null;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  mentor
}) => {
  if (!isOpen || !mentor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl border border-slate-200 p-6 md:p-8 relative shadow-2xl space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <img
              src={mentor.avatar}
              alt={mentor.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-slate-100 shadow-md mx-auto"
            />
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-broski-yellow" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-slate-900" />
              <span>Mentor Broski Plus</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mentor.name} is available with Mentor Broski Plus
            </h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Upgrade to unlock additional specialized mentors and build continuous relationships across AI/ML, Cybersecurity, and Data Analytics.
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
          <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Included in Plus:</div>
          <ul className="space-y-2 text-xs font-medium text-slate-700">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Chat with <strong>all 3 specialized AI mentors</strong></span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Unlimited continuous conversation history</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Priority response times & diagnostic feedback</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              alert('Mentor Broski Plus upgrade checkout coming soon! Your active mentor remains fully accessible.');
              onClose();
            }}
            className="w-full py-3.5 rounded-xl btn-broski-primary text-sm flex items-center justify-center gap-2 group min-h-[44px]"
          >
            <span>Upgrade to Plus</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[44px]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
