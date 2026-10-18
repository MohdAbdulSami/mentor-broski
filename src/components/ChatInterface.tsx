import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  ExternalLink, 
  Bot,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { MentorId, MentorDomain, PersonalityStyle, UserProfile, ChatMessage, UserMemory, RoadmapPlan } from '../types';
import { MENTORS, PERSONALITIES } from '../data/mentors';
import { MemoryStore } from '../services/memoryStore';
import { RoadmapDrawer } from './RoadmapDrawer';
import { ProactiveBanner } from './ProactiveBanner';
import { ChatOrchestrator } from '../services/chatOrchestrator';
import { RetrievalService } from '../services/retrievalService';
import { RoadmapManager } from '../services/roadmapManager';
import { OnboardingManager } from '../services/onboardingManager';
import { ReminderScheduler } from '../services/reminderScheduler';

interface ChatInterfaceProps {
  user: UserProfile;
  mentorId: MentorId;
  personality: PersonalityStyle;
  onChangeMentor: () => void;
  onChangePersonality: () => void;
  onRoadmapCreated?: (roadmap: RoadmapPlan) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  user,
  mentorId,
  personality,
  onChangeMentor,
  onChangePersonality,
  onRoadmapCreated
}) => {
  const mentor = MENTORS[mentorId];
  const pers = PERSONALITIES[personality];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [memory, setMemory] = useState<UserMemory>(() => MemoryStore.getMemory());
  const [roadmap, setRoadmap] = useState<RoadmapPlan | null>(null);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState<boolean>(true);
  
  const [isRoadmapOpen, setIsRoadmapOpen] = useState<boolean>(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize background reminder scheduler and event listener
  useEffect(() => {
    if (user?.id) {
      ReminderScheduler.init(user.id);
    }

    const handleReminderDue = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const reminder = customEvent.detail;
      if (!reminder) return;

      const reminderText = ReminderScheduler.generateEscalatedReminderText(
        reminder,
        mentorId,
        personality,
        user.name || 'Student'
      );

      if (conversationId) {
        const persisted = await RetrievalService.persistMessage(
          conversationId,
          user.id,
          'mentor',
          reminderText,
          { isReminder: true, commitmentId: reminder.id }
        );
        if (persisted) {
          setMessages(prev => {
            if (prev.some(m => m.id === persisted.id)) return prev;
            return [...prev, persisted];
          });
          speakText(persisted.text);
          return;
        }
      }

      const reminderMsg: ChatMessage = {
        id: 'msg_rem_' + Date.now(),
        sender: 'mentor',
        text: reminderText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, reminderMsg]);
      speakText(reminderMsg.text);
    };

    const handleProactiveCheckinEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ChatMessage>;
      const proactiveMsg = customEvent.detail;
      if (!proactiveMsg) return;

      setMessages(prev => {
        if (prev.some(m => m.id === proactiveMsg.id)) return prev;
        return [...prev, proactiveMsg];
      });
      speakText(proactiveMsg.text);
    };

    window.addEventListener('mentor-broski-reminder-due', handleReminderDue);
    window.addEventListener('mentor-broski-proactive-checkin', handleProactiveCheckinEvent);

    return () => {
      ReminderScheduler.stop();
      window.removeEventListener('mentor-broski-reminder-due', handleReminderDue);
      window.removeEventListener('mentor-broski-proactive-checkin', handleProactiveCheckinEvent);
    };
  }, [user?.id, conversationId, mentorId, personality, user.name]);

  // 2. Initialize persistent conversation, load history, and check for mentor-initiated onboarding
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      if (!user?.id) return;

      const [convId, dbMemories, dbCommitments, activeDbRoadmap] = await Promise.all([
        RetrievalService.getOrCreateConversation(user.id, mentorId, personality),
        RetrievalService.getRelevantMemories(user.id),
        RetrievalService.getActiveCommitments(user.id),
        RoadmapManager.getCurrentRoadmap(user.id, mentor.domain)
      ]);

      if (!isMounted) return;
      setConversationId(convId);

      if (activeDbRoadmap) {
        setActiveRoadmapId(activeDbRoadmap.id);
        setRoadmap({
          mentorId,
          domain: (activeDbRoadmap.domain as MentorDomain) || mentor.domain,
          createdDate: new Date(activeDbRoadmap.created_at).toLocaleDateString(),
          title: activeDbRoadmap.title,
          summary: activeDbRoadmap.summary || '',
          currentDay: activeDbRoadmap.current_day,
          stages: activeDbRoadmap.stages
        });
      } else {
        setActiveRoadmapId(null);
        setRoadmap(null);
      }
      setIsRoadmapLoading(false);

      // Build authoritative memory state directly from Supabase DB records
      setMemory(MemoryStore.buildUserMemoryFromDb(user, dbMemories, dbCommitments));

      if (convId) {
        const history = await RetrievalService.getRecentMessages(convId, 30);
        if (isMounted) setMessages(history);

        // Check if mentor needs to initiate sequential onboarding!
        const mentorInitiatedMsg = await OnboardingManager.checkAndTriggerMentorInitiatedOnboarding({
          userId: user.id,
          conversationId: convId,
          mentorId,
          personality,
          currentProfile: user,
          recentMessagesCount: history.length
        });

        if (mentorInitiatedMsg && isMounted) {
          setMessages(prev => {
            if (prev.some(m => m.id === mentorInitiatedMsg.id)) return prev;
            return [...prev, mentorInitiatedMsg];
          });
          speakText(mentorInitiatedMsg.text);
        }
      } else {
        if (isMounted) setMessages([]);
      }
    }

    loadHistory();
    return () => { isMounted = false; };
  }, [user?.id, mentorId, personality]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if (!isTtsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_]/g, ''));
    utterance.rate = 1.0;
    utterance.pitch = personality === 'BUBBLY' ? 1.2 : personality === 'STRICT' ? 0.9 : 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setInput('');
    setIsLoading(true);

    // Render optimistic user message immediately in chat feed before orchestrator call
    const optimisticId = 'temp_user_msg_' + Date.now();
    const optimisticUserMsg: ChatMessage = {
      id: optimisticId,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, optimisticUserMsg]);

    try {
      const orchestratorResult = await ChatOrchestrator.handleChatMessage({
        userId: user.id,
        mentorId,
        personality,
        userMessage: query,
        conversationId: conversationId,
        currentUserProfile: user
      });

      if (!orchestratorResult.success || !orchestratorResult.data) {
        console.error('Orchestrator error:', orchestratorResult.error);
        return;
      }

      const pipelineResult = orchestratorResult.data;

      if (pipelineResult.conversationId) {
        setConversationId(pipelineResult.conversationId);
      }

      setMessages(prev => {
        // Swap out the optimistic temp message for the actual DB-persisted user message record, and append mentor response
        const filtered = prev.filter(m => m.id !== optimisticId);
        const hasRealUserMsg = filtered.some(m => m.id === pipelineResult.userMessageRecord.id);
        const nextList = hasRealUserMsg ? filtered : [...filtered, pipelineResult.userMessageRecord];
        return [...nextList, pipelineResult.mentorMessageRecord];
      });

      speakText(pipelineResult.mentorMessageRecord.text);

      // Only activate roadmap drawer if the user explicitly requested a roadmap
      if (pipelineResult.detectedIntent === 'ROADMAP_REQUEST' && pipelineResult.roadmapRecord) {
        const activeRoadmap = pipelineResult.roadmapRecord;
        setActiveRoadmapId(activeRoadmap.id);
        const plan: RoadmapPlan = {
          mentorId,
          domain: (activeRoadmap.domain as MentorDomain) || mentor.domain,
          createdDate: new Date(activeRoadmap.created_at).toLocaleDateString(),
          title: activeRoadmap.title,
          summary: activeRoadmap.summary || '',
          currentDay: activeRoadmap.current_day,
          stages: activeRoadmap.stages
        };
        setRoadmap(plan);
        setIsRoadmapOpen(true);
        if (onRoadmapCreated) onRoadmapCreated(plan);
      } else if (pipelineResult.detectedIntent === 'PROGRESSION_CONTINUE' && pipelineResult.roadmapRecord) {
        const activeRoadmap = pipelineResult.roadmapRecord;
        setActiveRoadmapId(activeRoadmap.id);
        const plan: RoadmapPlan = {
          mentorId,
          domain: (activeRoadmap.domain as MentorDomain) || mentor.domain,
          createdDate: new Date(activeRoadmap.created_at).toLocaleDateString(),
          title: activeRoadmap.title,
          summary: activeRoadmap.summary || '',
          currentDay: activeRoadmap.current_day,
          stages: activeRoadmap.stages
        };
        setRoadmap(plan);
      }
    } catch (err) {
      console.error('Error processing message through orchestrator:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleProactiveCheckIn = async (customText?: string) => {
    let checkInText = '';
    if (personality === 'STRICT') {
      checkInText = `Hey ${user.name}. You mentioned you'd finish the project last night. How did it go? Did you finish, or does our strategy need adjusting?`;
    } else if (personality === 'BUBBLY') {
      checkInText = `Hellooo ${user.name}! 👀 Quick progress check! Did today's coding exercise happen or are we pretending it didn't exist? 😂 Tell me how it went!`;
    } else {
      checkInText = `Hey ${user.name}! 😊 Just checking in to see how yesterday's task went. Did you get a chance to work on it?`;
    }

    const checkInMsgText = customText || checkInText;

    if (conversationId) {
      const persisted = await RetrievalService.persistMessage(
        conversationId,
        user.id,
        'mentor',
        checkInMsgText,
        { isProactive: true }
      );
      if (persisted) {
        setMessages(prev => [...prev, persisted]);
        speakText(persisted.text);
        return;
      }
    }

    const checkInMsg: ChatMessage = {
      id: 'msg_pro_' + Date.now(),
      sender: 'mentor',
      text: checkInMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isProactiveCheckIn: true
    };

    setMessages(prev => [...prev, checkInMsg]);
    speakText(checkInMsg.text);
  };

  const handleToggleTask = async (taskId: string) => {
    if (!roadmap || !user?.id) return;

    let activeRecord = await RoadmapManager.getCurrentRoadmap(user.id, mentor.domain);
    if (!activeRecord) {
      activeRecord = await RoadmapManager.getOrCreateUserRoadmap(
        user.id,
        mentor.domain,
        'BEGINNER',
        30,
        'GENERAL'
      );
    }

    if (activeRecord) {
      const { updatedRoadmap, completedDayNumber } = await RoadmapManager.markTaskComplete(user.id, activeRecord.id, taskId);
      if (updatedRoadmap) {
        setActiveRoadmapId(updatedRoadmap.id);
        // Update roadmap UI state (task shows completed, current_day NOT advanced yet)
        const plan: RoadmapPlan = {
          mentorId,
          domain: (updatedRoadmap.domain as MentorDomain) || mentor.domain,
          createdDate: new Date(updatedRoadmap.created_at).toLocaleDateString(),
          title: updatedRoadmap.title,
          summary: updatedRoadmap.summary || '',
          currentDay: updatedRoadmap.current_day,
          stages: updatedRoadmap.stages
        };
        setRoadmap(plan);

        // Inject mentor's "Continue now or tomorrow?" prompt into chat (Objective 7)
        if (conversationId) {
          const progressionPrompt = await ChatOrchestrator.handleDayCompletionPrompt({
            userId: user.id,
            mentorId,
            conversationId,
            completedDayNumber,
            roadmapId: updatedRoadmap.id
          });
          if (progressionPrompt) {
            setMessages(prev => {
              if (prev.some(m => m.id === progressionPrompt.id)) return prev;
              return [...prev, progressionPrompt];
            });
            speakText(progressionPrompt.text);
          }
        }
      }
    }
  };

  const handleProgressionChoice = async (choice: 'CONTINUE_NOW' | 'TOMORROW', dayNumber: number) => {
    if (!user?.id || !activeRoadmapId) return;

    if (choice === 'CONTINUE_NOW') {
      // advanceToNextDay calls the secure RPC once. Do NOT call it again inside handleProgressionContinueNow.
      const updated = await RoadmapManager.advanceToNextDay(user.id, activeRoadmapId, dayNumber);
      if (updated) {
        setRoadmap({
          mentorId,
          domain: (updated.domain as MentorDomain) || mentor.domain,
          createdDate: new Date(updated.created_at).toLocaleDateString(),
          title: updated.title,
          summary: updated.summary || '',
          currentDay: updated.current_day,
          stages: updated.stages
        });

        if (conversationId) {
          // Pass the already-advanced roadmap so the orchestrator only builds the message,
          // it does NOT call advanceToNextDay again.
          const { message: mentorMsg } = await ChatOrchestrator.buildProgressionContinueNowMessage({
            userId: user.id,
            mentorId,
            conversationId,
            roadmapId: updated.id,
            completedDayNumber: dayNumber
          });
          if (mentorMsg) {
            setMessages(prev => [...prev, mentorMsg]);
            speakText(mentorMsg.text);
          }
        }
      } else {
        // Progression blocked (quiz not passed, tasks incomplete, etc.) — surface this to the student
        const blockedText = `⚠️ **Continue Now is blocked.** Make sure you've completed all Day ${dayNumber} tasks and passed the Day ${dayNumber} quiz with a passing score before advancing.`;
        if (conversationId) {
          const errMsg = await RetrievalService.persistMessage(
            conversationId, user.id, 'mentor', blockedText, { isProactive: true }
          );
          if (errMsg) {
            setMessages(prev => [...prev, errMsg]);
          } else {
            setMessages(prev => [...prev, {
              id: 'msg_blocked_' + Date.now(),
              sender: 'mentor' as const,
              text: blockedText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
          }
        }
      }
    } else {
      // User chooses tomorrow: schedule commitment/reminder and notify in chat
      if (conversationId) {
        const nextDay = dayNumber + 1;
        const mentorMsg = await ChatOrchestrator.handleProgressionScheduleTomorrow({
          userId: user.id,
          mentorId,
          conversationId,
          roadmapId: activeRoadmapId,
          nextDay
        });
        if (mentorMsg) {
          setMessages(prev => [...prev, mentorMsg]);
          speakText(mentorMsg.text);
        }
      }
    }
  };

  const handleQuizCompleted = async (result: any, dayNumber: number, topic: string) => {
    if (!conversationId || !user?.id) return;
    try {
      const followUpMsg = await ChatOrchestrator.handlePostQuizFollowUp({
        userId: user.id,
        mentorId,
        conversationId,
        quizResult: {
          score: result.score,
          passed: result.passed,
          totalQuestions: result.total_questions,
          correctCount: result.correct_count,
          dayNumber,
          topic
        }
      });
      if (followUpMsg) {
        setMessages(prev => [...prev, followUpMsg]);
        speakText(followUpMsg.text);
      }
    } catch (e) {
      console.error('Error triggering post-quiz follow up in chat:', e);
    }
  };

  const handleExtendRoadmap = async (totalDays: number) => {
    if (!user?.id) return;
    const { RoadmapResolver } = await import('../services/roadmapResolver');
    const resolution = await RoadmapResolver.resolveRoadmap({
      userId: user.id,
      domain: mentor.domain,
      requestedLevel: user.experienceLevel || 'BEGINNER',
      requestedDuration: totalDays,
      requestedFocus: 'GENERAL'
    });
    if (resolution.roadmap) {
      setActiveRoadmapId(resolution.roadmap.id);
      const plan: RoadmapPlan = {
        mentorId,
        domain: (resolution.roadmap.domain as MentorDomain) || mentor.domain,
        createdDate: new Date(resolution.roadmap.created_at).toLocaleDateString(),
        title: resolution.roadmap.title,
        summary: resolution.roadmap.summary || '',
        currentDay: resolution.roadmap.current_day,
        stages: resolution.roadmap.stages
      };
      setRoadmap(plan);
    }
  };

  const domainPattern = mentorId === 'AARYA' ? 'pattern-aarya' : mentorId === 'ALEX' ? 'pattern-alex' : 'pattern-lucy';

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-white relative ${domainPattern}`}>
      {/* Ambient Living Background Blobs */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-broski-yellow/10 rounded-full blur-3xl pointer-events-none animate-ambient-blob" />

      {/* Header Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between z-10 font-sans">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img src={mentor.avatar} alt={mentor.name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow-xs" />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-900 text-sm md:text-base truncate">{mentor.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold shrink-0">
                {mentor.subjectBadge}
              </span>
            </div>
            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ● Active Mentor • {pers.title} Tone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Conditional Roadmap Drawer Access Button - Visible only when persisted roadmap exists */}
          {!isRoadmapLoading && (roadmap || activeRoadmapId) && (
            <button
              onClick={async () => {
                if (!roadmap) {
                  const activeRecord = await RoadmapManager.getCurrentRoadmap(user.id, mentor.domain);
                  if (activeRecord) {
                    setActiveRoadmapId(activeRecord.id);
                    setRoadmap({
                      mentorId,
                      domain: (activeRecord.domain as MentorDomain) || mentor.domain,
                      createdDate: new Date(activeRecord.created_at).toLocaleDateString(),
                      title: activeRecord.title,
                      summary: activeRecord.summary || '',
                      currentDay: activeRecord.current_day,
                      stages: activeRecord.stages
                    });
                  }
                }
                setIsRoadmapOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] shadow-xs cursor-pointer animate-fadeIn"
              title="Open Learning Roadmap"
            >
              <Calendar className="w-4 h-4 text-broski-yellow" />
              <span className="hidden sm:inline">Roadmap</span>
            </button>
          )}

          <button
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            className={`p-2 rounded-xl text-xs border transition-colors flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${
              isTtsEnabled ? 'bg-broski-yellow text-slate-900 border-slate-900 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
            title="Toggle Text-to-Speech"
          >
            {isTtsEnabled ? <Volume2 className="w-4 h-4 text-slate-900" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Proactive Check-In Banner */}
      <ProactiveBanner
        personality={personality}
        onTriggerCheckIn={handleProactiveCheckIn}
      />

      {/* Message Feed / Empty State */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full relative z-10 font-sans">
        {messages.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center text-center my-12 md:my-16 space-y-4 px-4"
          >
            <div className="relative">
              <img 
                src={mentor.avatar} 
                alt={mentor.name} 
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl" 
              />
              <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>

            <div className="max-w-md space-y-2">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Okay, your turn.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Tell me where you’re at right now.<br />
                No polished answer needed.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {[
                `Hey ${mentor.name}, I need help building my portfolio.`,
                `I'm stuck on a project idea right now.`,
                `What's the #1 skill I should focus on today?`
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(promptText)}
                  className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-broski-yellow border border-slate-200 hover:border-slate-900 text-slate-800 text-xs font-semibold transition-all min-h-[44px]"
                >
                  "{promptText}"
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.sender === 'mentor' && (
                  <img src={mentor.avatar} alt={mentor.name} className="w-8 h-8 rounded-full object-cover shrink-0 mt-1 shadow-xs" />
                )}

                <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] text-slate-500 font-bold">
                      {msg.sender === 'user' ? user.name : mentor.name}
                    </span>
                    {msg.isProactiveCheckIn && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono font-bold">
                        Proactive Check-In
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[88%] md:max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'chat-bubble-student rounded-tr-none'
                        : 'chat-bubble-mentor rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans">{msg.text}</div>

                    {msg.resources && msg.resources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                          Recommended Resources ({msg.resources.length})
                        </span>
                        <div className="space-y-2">
                          {msg.resources.map((res, i) => (
                            <a
                              key={i}
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs transition-all group"
                            >
                              <div className="flex items-center justify-between font-bold text-slate-900">
                                <span className="flex items-center gap-1.5">
                                  {res.title}
                                  <ExternalLink className="w-3 h-3 text-slate-500" />
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold">
                                  {res.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1">{res.description}</p>
                              <p className="text-[10px] text-slate-500 italic mt-1.5">
                                Why use this: {res.whyRecommended}
                              </p>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 max-w-xs shadow-xs"
          >
            <img src={mentor.avatar} alt={mentor.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-700 font-bold">{mentor.name} is typing</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 relative z-20 font-sans">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-4xl mx-auto flex items-end gap-2 md:gap-3"
        >
          <div className="flex-1 relative">
            <textarea
              rows={1}
              placeholder={messages.length === 0 ? `Tell ${mentor.name} what's going on…` : `Message ${mentor.name}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 input-yellow-focus transition-all resize-none min-h-[48px] max-h-32 font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 min-h-[48px] shrink-0 ${
              input.trim() && !isLoading
                ? 'btn-broski-primary border border-slate-900 cursor-pointer'
                : 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
            }`}
          >
            <span>Send</span>
            <Send className="w-4 h-4 text-slate-900" />
          </button>
        </form>
      </div>

      {/* Living Roadmap Drawer */}
      {roadmap && (
        <RoadmapDrawer
          isOpen={isRoadmapOpen}
          onClose={() => setIsRoadmapOpen(false)}
          roadmap={roadmap}
          userId={user.id}
          roadmapId={activeRoadmapId || 'temp_roadmap'}
          onToggleTask={handleToggleTask}
          onAskMentorAboutTask={(task) => {
            setIsRoadmapOpen(false);
            handleSendMessage(`Can you explain how to tackle today's task: "${task.title}"?`);
          }}
          onExtendRoadmap={handleExtendRoadmap}
          onQuizCompleted={handleQuizCompleted}
          onProgressionChoice={handleProgressionChoice}
        />
      )}
    </div>
  );
};
