import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Zap, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PersonalityStyle, MentorId } from '../types';
import { PERSONALITIES, MENTORS } from '../data/mentors';

interface PersonalitySelectorProps {
  selectedMentorId: MentorId;
  onSelectPersonality: (style: PersonalityStyle) => void;
  onBack: () => void;
  selectedPersonality?: PersonalityStyle | null;
}

export const PersonalitySelector: React.FC<PersonalitySelectorProps> = ({
  selectedMentorId,
  onSelectPersonality,
  onBack,
  selectedPersonality = null
}) => {
  const mentor = MENTORS[selectedMentorId];

  const styles: { style: PersonalityStyle; title: string; icon: React.ElementType; badge: string; desc: string; sample: string }[] = [
    {
      style: 'FRIENDLY',
      title: 'Friendly',
      icon: Heart,
      badge: 'Warm & Patient',
      desc: 'Warm, patient, supportive, and conversational. Focuses on building confidence and understanding your pace.',
      sample: PERSONALITIES.FRIENDLY.sampleQuote
    },
    {
      style: 'STRICT',
      title: 'Strict',
      icon: Zap,
      badge: 'Direct & Honest',
      desc: 'Direct, honest, accountable, and firm. Zero sugarcoating while remaining 100% constructive.',
      sample: PERSONALITIES.STRICT.sampleQuote
    },
    {
      style: 'BUBBLY',
      title: 'Bubbly',
      icon: Sparkles,
      badge: 'Energetic & Playful',
      desc: 'Energetic, casual, playful, and enthusiastic. Keeps learning lively and engaging.',
      sample: PERSONALITIES.BUBBLY.sampleQuote
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Background Soft Blob */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-broski-yellow/15 rounded-full blur-3xl pointer-events-none animate-ambient-blob" />

      <div className="max-w-5xl mx-auto w-full space-y-10 relative z-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Mentor Selection</span>
        </button>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
            Step 2 of 2 • Communication Style ({mentor.name})
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            How do you want {mentor.name} to talk to you?
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm font-medium leading-relaxed">
            Choose the communication tone that best drives your daily focus. Tone alters communication style, NOT technical expertise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {styles.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedPersonality === item.style;

            return (
              <motion.div
                key={item.style}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                onClick={() => onSelectPersonality(item.style)}
                className={`social-card rounded-2xl p-6 cursor-pointer flex flex-col justify-between group relative transition-all ${
                  isSelected
                    ? 'border-2 border-slate-900 bg-broski-yellow/15 shadow-md'
                    : 'bg-white hover:border-slate-400'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold border ${
                      isSelected ? 'bg-broski-yellow text-slate-900 border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                      {item.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                      <span>{item.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {item.desc}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Sample Voice</span>
                    <p className="text-xs text-slate-800 italic leading-relaxed font-medium">
                      {item.sample}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPersonality(item.style);
                  }}
                  className={`mt-6 w-full py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                    isSelected
                      ? 'btn-broski-primary border border-slate-900'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <span>{isSelected ? 'Selected Tone' : `Select ${item.title}`}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
