import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Brain, 
  Clock, 
  Zap,
  UserCheck
} from 'lucide-react';
import { MENTORS } from '../data/mentors';
import { MentorId } from '../types';

interface LandingPageProps {
  onStart: (mentorId?: MentorId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleMessages(prev => (prev < 4 ? prev + 1 : prev));
    }, 1100);

    return () => clearInterval(timer);
  }, []);

  const heroMessages = [
    {
      sender: 'mentor',
      name: 'Aarya',
      avatar: MENTORS.AARYA.avatar,
      text: "Okay, before I throw 20 resources at you... what are you actually trying to build?"
    },
    {
      sender: 'student',
      name: 'Student',
      text: "I'm a second-year CS student. I want to build real AI projects, but I don't know where to start."
    },
    {
      sender: 'mentor',
      name: 'Aarya',
      avatar: MENTORS.AARYA.avatar,
      text: "Got it! Let's skip the theoretical fluff. How comfortable are you writing raw Python right now?"
    },
    {
      sender: 'student',
      name: 'Student',
      text: "I know basic syntax, but I've never touched PyTorch or built an end-to-end model."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-slate-900 selection:text-broski-yellow overflow-x-hidden">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-broski-yellow font-black text-lg shadow-md">
              MB
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                Mentor Broski <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-broski-yellow text-slate-900 font-bold">AI</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#mentors" className="hover:text-slate-900 transition-colors">Meet Mentors</a>
            <a href="#why-different" className="hover:text-slate-900 transition-colors">Why It Feels Different</a>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => onStart()}
              className="px-5 py-2.5 rounded-xl btn-broski-primary text-sm flex items-center gap-2 group min-h-[44px]"
            >
              <span>Meet Your Mentor</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 bg-white border-b border-slate-200 overflow-hidden">
        {/* Soft Ambient Blob */}
        <div className="absolute top-10 right-10 w-96 h-96 bg-broski-yellow/30 rounded-full blur-3xl pointer-events-none animate-ambient-blob" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column Text */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-6 space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-slate-900" />
              <span>Your Personal AI Mentor in Messages</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
              Your AI mentor for the <span className="bg-broski-yellow px-2 py-0.5 inline-block">career you’re building.</span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed font-normal">
              Choose a mentor, tell them where you are, and have someone who actually remembers your goals, helps you figure out what to do next, and checks back on you.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button 
                onClick={() => onStart()}
                className="px-8 py-4 rounded-xl btn-broski-primary text-base text-center flex items-center justify-center gap-3 group min-h-[44px]"
              >
                <span>Meet Your Mentor</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a 
                href="#how-it-works"
                className="px-7 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-base transition-all text-center min-h-[44px] flex items-center justify-center"
              >
                See How It Works
              </a>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-6 text-xs text-slate-600 font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>3 Specialized Mentors</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Remembers Your Goals</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Messaging-First Inbox</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column Visual: Showcase Real Mentor Conversation */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-6"
          >
            <div className="social-card rounded-2xl p-6 relative overflow-hidden border border-slate-200 shadow-xl bg-white">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={MENTORS.AARYA.avatar} 
                      alt="Aarya" 
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-200" 
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Aarya</h3>
                    <p className="text-xs text-emerald-600 font-bold">AI / ML • ● Active</p>
                  </div>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-broski-yellow text-slate-900 font-black">
                  Mentor Inbox
                </span>
              </div>

              {/* Chat Stream */}
              <div className="space-y-4 min-h-[320px] flex flex-col justify-end">
                <AnimatePresence>
                  {heroMessages.slice(0, visibleMessages).map((msg, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-start gap-2.5 ${msg.sender === 'student' ? 'flex-row-reverse' : ''}`}
                    >
                      {msg.sender === 'mentor' && (
                        <img src={msg.avatar} alt={msg.name} className="w-7 h-7 rounded-full object-cover shrink-0 mt-1 shadow-xs" />
                      )}
                      <div 
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.sender === 'student' 
                            ? 'chat-bubble-student rounded-tr-none' 
                            : 'chat-bubble-mentor rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-extrabold">Simple 5-Step Experience</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900">How Mentor Broski Works</h2>
          <p className="text-slate-600 max-w-xl mx-auto text-sm">
            Built around an ongoing, personal DM relationship with your specialized AI mentor.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              step: '01',
              title: 'Choose your mentor',
              desc: 'Pick the career area you want help with (Aarya, Alex, or Lucy).',
              icon: UserCheck
            },
            {
              step: '02',
              title: 'Start talking',
              desc: 'Your mentor gets to know you naturally through DM conversations.',
              icon: MessageSquare
            },
            {
              step: '03',
              title: 'Get guidance',
              desc: 'Ask direct questions, debug code, and figure out what to do next.',
              icon: Zap
            },
            {
              step: '04',
              title: 'Your mentor remembers',
              desc: 'Your goals, preferences, and commitments stay remembered in memory.',
              icon: Brain
            },
            {
              step: '05',
              title: 'Proactive check-ins',
              desc: 'Get thoughtful check-ins when you mention commitments.',
              icon: Clock
            }
          ].map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <motion.div 
                key={idx}
                whileHover={{ y: -4 }}
                className="social-card p-6 rounded-2xl flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-slate-900 px-2.5 py-1 rounded bg-broski-yellow">
                      {item.step}
                    </span>
                    <IconComponent className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3 — MEET YOUR MENTORS */}
      <section id="mentors" className="py-20 px-6 bg-slate-50/50 border-t border-b border-slate-200">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-extrabold">Specialized AI Mentors</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Meet Your Mentors</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-sm">
              Three specialized mentor characters focused on real domain expertise and continuous guidance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* AARYA */}
            <div className="social-card rounded-2xl p-7 flex flex-col justify-between group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <img src={MENTORS.AARYA.avatar} alt="Aarya" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-md" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-bold">
                    AI / ML
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900">Aarya</h3>
                  <p className="text-xs text-slate-700 font-semibold mb-3 italic">"{MENTORS.AARYA.profileQuote}"</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{MENTORS.AARYA.bio}</p>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Expertise</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MENTORS.AARYA.expertiseList.map((ex, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onStart('AARYA')}
                className="mt-8 w-full py-3.5 rounded-xl btn-broski-primary text-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Talk to Aarya</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* ALEX */}
            <div className="social-card rounded-2xl p-7 flex flex-col justify-between group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <img src={MENTORS.ALEX.avatar} alt="Alex" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-md" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-bold">
                    Cybersecurity
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900">Alex</h3>
                  <p className="text-xs text-slate-700 font-semibold mb-3 italic">"{MENTORS.ALEX.profileQuote}"</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{MENTORS.ALEX.bio}</p>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Expertise</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MENTORS.ALEX.expertiseList.map((ex, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onStart('ALEX')}
                className="mt-8 w-full py-3.5 rounded-xl btn-broski-primary text-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Talk to Alex</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* LUCY */}
            <div className="social-card rounded-2xl p-7 flex flex-col justify-between group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <img src={MENTORS.LUCY.avatar} alt="Lucy" className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-md" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-bold">
                    Data Analytics
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900">Lucy</h3>
                  <p className="text-xs text-slate-700 font-semibold mb-3 italic">"{MENTORS.LUCY.profileQuote}"</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{MENTORS.LUCY.bio}</p>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Expertise</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MENTORS.LUCY.expertiseList.map((ex, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onStart('LUCY')}
                className="mt-8 w-full py-3.5 rounded-xl btn-broski-primary text-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Talk to Lucy</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — WHY IT FEELS DIFFERENT */}
      <section id="why-different" className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-extrabold">The Mentor Broski Difference</span>
          <blockquote className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-snug">
            "Most learning platforms give you generic video content.<br />
            <span className="bg-broski-yellow px-2 py-0.5">Your mentor helps you figure out what YOU should do with it."</span>
          </blockquote>
          <p className="text-slate-600 text-base max-w-2xl mx-auto leading-relaxed">
            Instead of endless playlists that leave you stranded, your mentor continuously remembers your situation, answers direct technical questions, and checks back on your commitments.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            Ready to meet your mentor?
          </h2>
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Choose your specialized mentor today and start building your career with someone who actually remembers your goals.
          </p>
          <div>
            <button 
              onClick={() => onStart()}
              className="px-9 py-4 rounded-xl btn-broski-primary text-lg inline-flex items-center gap-3 group min-h-[44px]"
            >
              <span>Choose My Mentor</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">Mentor Broski</span> — Personal AI Career Mentor
          </div>
          <p>© 2026 Mentor Broski. Built for ambitious students.</p>
        </div>
      </footer>
    </div>
  );
};
