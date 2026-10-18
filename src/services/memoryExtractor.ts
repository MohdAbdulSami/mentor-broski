import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DbMemoryRecord } from '../types';

export interface ExtractedFact {
  keyCategory: string;
  content: string;
}

export class MemoryExtractor {
  static extractFactsFromMessage(text: string): ExtractedFact[] {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const facts: ExtractedFact[] = [];

    // Skip casual small talk and questions (e.g. "What is Python?", "Explain X")
    const casualWords = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'bye', 'goodbye', 'cool'];
    const questionTriggers = ['what is', 'how to', 'how do i', 'can you', 'explain', 'why does', 'difference between', 'tell me about'];
    const isQuestion = trimmed.endsWith('?') || questionTriggers.some(q => lower.includes(q));

    if (casualWords.includes(lower) || trimmed.split(/\s+/).length <= 2 || isQuestion) {
      return facts;
    }

    // 1. Learning Style
    if (lower.includes('project-based') || lower.includes('building projects') || lower.includes('hands-on') || lower.includes('practical')) {
      facts.push({ keyCategory: 'learning_style', content: 'Prefers hands-on, project-based practical learning' });
    } else if (lower.includes('video course') || lower.includes('video tutorial') || lower.includes('watch videos')) {
      facts.push({ keyCategory: 'learning_style', content: 'Prefers visual learning via video tutorials' });
    } else if (lower.includes('reading docs') || lower.includes('official documentation') || lower.includes('reading books')) {
      facts.push({ keyCategory: 'learning_style', content: 'Prefers reading documentation and written tutorials' });
    }

    // 2. Career Goal / Target Role
    if (lower.includes('product manager') || lower.includes('pm role') || lower.includes('product management')) {
      facts.push({ keyCategory: 'career_goal', content: 'Wants to become a Product Manager' });
    } else if (lower.includes('ai engineer') || lower.includes('machine learning engineer') || lower.includes('ml engineer')) {
      facts.push({ keyCategory: 'career_goal', content: 'Targeting AI / Machine Learning Engineer roles' });
    } else if (lower.includes('cybersecurity') || lower.includes('security analyst') || lower.includes('ethical hacker')) {
      facts.push({ keyCategory: 'career_goal', content: 'Targeting Cybersecurity Analyst / Security Engineer roles' });
    } else if (lower.includes('data scientist') || lower.includes('data analyst')) {
      facts.push({ keyCategory: 'career_goal', content: 'Targeting Data Science / Data Analyst roles' });
    } else if (lower.includes('internship')) {
      facts.push({ keyCategory: 'career_goal', content: 'Targeting summer/entry-level internships' });
    }

    // 3. Technical Skills
    const skillList = [
      'python', 'java', 'c++', 'javascript', 'typescript', 'react', 'sql', 'pandas', 'numpy',
      'linux', 'bash', 'git', 'pytorch', 'tensorflow', 'wireshark', 'docker', 'aws'
    ];
    skillList.forEach(skill => {
      if (lower.includes(skill)) {
        facts.push({ keyCategory: 'skill', content: `Knows or learning ${skill}` });
      }
    });

    // 4. Learning Window / Daily Schedule
    if (lower.includes('evening') || lower.includes('night') || lower.includes('7 pm') || lower.includes('8 pm')) {
      facts.push({ keyCategory: 'preferred_learning_window', content: 'Prefers studying in the evenings after college/work' });
    } else if (lower.includes('morning') || lower.includes('6 am') || lower.includes('7 am')) {
      facts.push({ keyCategory: 'preferred_learning_window', content: 'Prefers early morning study sessions' });
    } else if (lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday')) {
      facts.push({ keyCategory: 'preferred_learning_window', content: 'Focuses heavy learning blocks on weekends' });
    }

    // 5. Obstacles & Dislikes
    if (lower.includes('struggle with') || lower.includes('stuck on') || lower.includes('hard to understand')) {
      facts.push({ keyCategory: 'current_obstacles', content: `Mentioned difficulty: "${trimmed.slice(0, 100)}"` });
    }
    if (lower.includes("don't like") || lower.includes('dislike') || lower.includes('hate')) {
      facts.push({ keyCategory: 'dislike_preference', content: `Dislikes: "${trimmed.slice(0, 100)}"` });
    }

    return facts;
  }

  static async saveExtractedMemories(userId: string, facts: ExtractedFact[]): Promise<DbMemoryRecord[]> {
    if (!userId || facts.length === 0 || !isSupabaseConfigured || !supabase) {
      return [];
    }

    const savedRecords: DbMemoryRecord[] = [];

    try {
      // 1. Fetch existing user memories for deduplication
      const { data: existing } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId);

      const existingMemories: DbMemoryRecord[] = existing || [];

      for (const fact of facts) {
        // Normalize content for similarity check
        const normContent = fact.content.toLowerCase().trim();

        // Check if a substantially similar memory exists
        const duplicate = existingMemories.find(m =>
          m.key_category === fact.keyCategory &&
          (m.content.toLowerCase().includes(normContent) || normContent.includes(m.content.toLowerCase()))
        );

        if (duplicate) {
          // Update existing memory timestamp / content if needed
          const { data: updated } = await supabase
            .from('memories')
            .update({ content: fact.content, created_at: new Date().toISOString() })
            .eq('id', duplicate.id)
            .select()
            .maybeSingle();

          if (updated) savedRecords.push(updated as DbMemoryRecord);
        } else {
          // Insert new memory
          const { data: inserted } = await supabase
            .from('memories')
            .insert({
              user_id: userId,
              key_category: fact.keyCategory,
              content: fact.content
            })
            .select()
            .maybeSingle();

          if (inserted) savedRecords.push(inserted as DbMemoryRecord);
        }
      }
    } catch (err) {
      console.error('Error saving extracted memories to Supabase:', err);
    }

    return savedRecords;
  }
}
