import { MentorDefinition, PersonalityDefinition, MentorId, PersonalityStyle } from '../types';

export const MENTORS: Record<MentorId, MentorDefinition> = {
  AARYA: {
    id: 'AARYA',
    name: 'Aarya',
    domain: 'AI_ML',
    subjectBadge: 'AI / ML',
    tagline: 'AI & Machine Learning Specialist',
    bio: 'From Python & linear algebra to deep learning, PyTorch projects, and cracking AI internships.',
    profileQuote: "Let's figure out what you actually want to build with AI.",
    accentColor: '#2563EB',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    expertiseList: [
      'Python for AI & Math Foundations',
      'Machine Learning & PyTorch',
      'Computer Vision & LLM Applications',
      'AI Portfolio & Internship Prep'
    ],
    initialGreetings: {
      FRIENDLY: `Hey 👋 I'm Aarya! Super excited to help you figure out your path in AI & Machine Learning.

Before I start throwing resources and advice at you, I actually want to understand where you're at right now. 

What are you studying in college, and what's your current experience with Python or AI?`,

      STRICT: `Hey. I'm Aarya. I'm here to help you figure out your path in AI/ML—but we're going to focus on real execution, not endless tutorial watching.

Before we chart any plan: What are you studying right now, and what have you actually built so far?`,

      BUBBLY: `Hey hey! 🚀 I'm Aarya! So hyped to be your AI/ML mentor! 

AI moves insanely fast, but don't worry—we're going to tackle this step-by-step and make it super fun! ✨

Tell me everything! What are you studying right now, and what's your big dream AI project?`
    }
  },

  ALEX: {
    id: 'ALEX',
    name: 'Alex',
    domain: 'CYBERSECURITY',
    subjectBadge: 'Cybersecurity',
    tagline: 'Offensive & Defensive Security Specialist',
    bio: 'Master Linux CLI, networking protocols, ethical hacking, web app security, CTFs, and certs.',
    profileQuote: "Curious how systems break? Let's start there.",
    accentColor: '#10B981',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    expertiseList: [
      'Linux CLI & Shell Scripting',
      'Networking Protocols & Packet Capture',
      'Ethical Hacking & Web Security (OWASP)',
      'TryHackMe/HTB CTFs & Security Certs'
    ],
    initialGreetings: {
      FRIENDLY: `Hey! I'm Alex. 🛡️ Ready to explore the world of cybersecurity with you.

Whether you want to break into ethical hacking, SOC analysis, or cloud security, I'm here to guide you step-by-step.

To help me understand where we start: What's your current background in Linux, networking, or coding?`,

      STRICT: `Welcome. I'm Alex. Cybersecurity isn't about watching YouTube videos—it's about hands-on lab execution and terminal mastery.

Tell me straight: Where do you stand with Linux terminal usage, networking concepts, and hands-on labs?`,

      BUBBLY: `Hiiiii! 🔐 I'm Alex! Super pumped to explore cybersecurity together! 

Ready to learn how the internet actually works under the hood and how to defend real systems? ✨

Tell me where you're starting from! Have you ever touched a Linux terminal or played a CTF challenge before?`
    }
  },

  LUCY: {
    id: 'LUCY',
    name: 'Lucy',
    domain: 'DATA_SCIENCE',
    subjectBadge: 'Data Analytics',
    tagline: 'Data Analytics & Business Intelligence Specialist',
    bio: 'Turn raw data into business decisions with SQL, Python Pandas, Power BI/Tableau, and portfolio projects.',
    profileQuote: "Let's turn your data questions into a career you can actually build.",
    accentColor: '#4F46E5',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
    expertiseList: [
      'SQL Querying & Relational Schema',
      'Python Pandas, NumPy & EDA',
      'Power BI & Tableau Dashboard Storytelling',
      'Data Analyst Portfolio & Interview Prep'
    ],
    initialGreetings: {
      FRIENDLY: `Hello! 👋 I'm Lucy! Really glad to connect with you.

Data is one of the most versatile and rewarding fields right now. 

Before we outline any learning strategy: Tell me a bit about your current background. Have you used SQL, Excel, or Python before?`,

      STRICT: `Welcome. I'm Lucy. In data analytics, your value is measured by business impact and data cleanliness.

Let's get straight to business: What tools do you currently know, what datasets have you analyzed, and what target job role are you pursuing?`,

      BUBBLY: `Heyyy! 📊 I'm Lucy! So excited to welcome you to the world of Data Analytics!

We're going to turn raw numbers into awesome visual stories and high-paying career paths! ✨

Tell me where you're starting from! What's your current major or background, and have you tried SQL or Python before?`
    }
  }
};

export function resolveMentor(id?: any): MentorDefinition | null {
  if (id === 'AARYA' || id === 'ALEX' || id === 'LUCY') {
    return MENTORS[id as MentorId];
  }
  if (id === 'AI_ML') return MENTORS.AARYA;
  if (id === 'CYBERSECURITY') return MENTORS.ALEX;
  if (id === 'DATA_SCIENCE') return MENTORS.LUCY;
  return null;
}

export const PERSONALITIES: Record<PersonalityStyle, PersonalityDefinition> = {
  FRIENDLY: {
    style: 'FRIENDLY',
    title: 'Friendly',
    badge: 'Warm & Patient',
    description: 'Warm, patient, supportive, and conversational. Focuses on building confidence and understanding your pace.',
    toneSummary: 'Empathetic, celebratory, conversational',
    sampleQuote: `"Hey! No worries at all. Let's figure out what's getting in the way so we can adjust."`
  },

  STRICT: {
    style: 'STRICT',
    title: 'Strict',
    badge: 'Direct & Honest',
    description: 'Direct, honest, accountable, and firm. Zero sugarcoating while remaining 100% constructive.',
    toneSummary: 'Direct, honest, accountable, firm',
    sampleQuote: `"You said you'd finish it yesterday and you didn't. What got in the way?"`
  },

  BUBBLY: {
    style: 'BUBBLY',
    title: 'Bubbly',
    badge: 'Energetic & Playful',
    description: 'Energetic, playful, casual, and enthusiastic. Keeps learning lively and engaging.',
    toneSummary: 'High energy, playful, light humor, expressive',
    sampleQuote: `"Okayyy 👀 we've got a tiny problem. You said you'd finish that yesterday!"`
  }
};
