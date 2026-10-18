import { MentorId, PersonalityStyle } from '../types';
import { MENTORS } from '../data/mentors';

export class CasualResponseHandler {
  /**
   * Identifies whether a user message is an ordinary greeting, reciprocal question,
   * status response, or polite social acknowledgment.
   */
  static isCasualMessage(text: string): boolean {
    // Strip punctuation and apostrophes for uniform matching
    const clean = text.trim().toLowerCase().replace(/['’.,!?;:]/g, '');
    if (!clean) return false;

    // 1. Direct greetings
    const greetings = [
      'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hii', 'hiii', 'heyy', 'heyyy',
      'good morning', 'good night', 'good evening', 'good afternoon'
    ];
    if (greetings.includes(clean)) return true;

    // 2. Greeting with mentor name or generic greeting, e.g. "hi lucy", "hello alex", "hey aarya", "hi there"
    if (/^(hi|hello|hey|yo|howdy)\s+(lucy|alex|aarya|there|mentor|broski|friend)$/i.test(clean)) {
      return true;
    }

    // 3. Reciprocal / social questions
    const socialQuestions = [
      'how are you', 'how are u', 'how r u', 'how are you doing', 'howre you doing',
      'how is it going', 'hows it going', 'hows work', 'whats up', 'whatsup',
      'how about you', 'what about you', 'wbu', 'hbu', 'and you'
    ];
    if (socialQuestions.includes(clean) || socialQuestions.some(sq => clean.startsWith(sq))) {
      return true;
    }

    // 4. Status responses / pleasantries
    const statusPhrases = [
      'im good', 'i am good', 'doing good', 'doing well', 'pretty good',
      'im doing good', 'im doing well', 'i am doing well', 'all good',
      'doing great', 'im great', 'i am great', 'im fine', 'i am fine',
      'good thanks', 'fine thanks', 'not bad', 'just chilling', 'fine', 'good', 'great'
    ];
    if (statusPhrases.includes(clean) || statusPhrases.some(sp => clean === sp || clean.startsWith(sp + ' '))) {
      return true;
    }

    // 5. Acknowledgments, agreement, & Closings
    const acknowledgments = [
      'thanks', 'thank you', 'thx', 'ty', 'thank you so much', 'thanks a lot',
      'bye', 'goodbye', 'see ya', 'see you', 'cya', 'ok', 'okay', 'cool', 'awesome',
      'got it', 'sounds good', 'sounds great', 'alright', 'all right'
    ];
    if (acknowledgments.includes(clean)) return true;

    return false;
  }

  static generateResponse(
    text: string,
    mentorId: MentorId,
    personality: PersonalityStyle | null,
    userName: string
  ): string {
    const clean = text.trim().toLowerCase().replace(/['’.,!?;:]/g, '');
    const mentor = MENTORS[mentorId] || MENTORS.AARYA;
    const tone = personality || 'FRIENDLY';
    const name = userName && userName !== 'Student' ? userName : '';

    // 1. Reciprocal social questions: "how are you", "what's up", "how about you"
    const isSocialQuestion = [
      'how are', 'how r u', 'whats up', 'whatsup', 'how about you', 'what about you', 'wbu', 'hbu', 'and you', 'how is it going', 'hows it going'
    ].some(sq => clean.includes(sq));

    if (isSocialQuestion) {
      if (tone === 'STRICT') {
        return `Doing well, ready to work. How are you doing today?`;
      } else if (tone === 'BUBBLY') {
        return `Doing fantastic, thanks for asking! ✨ How about you?`;
      } else {
        return `I'm doing good, thanks for asking! How about you?`;
      }
    }

    // 2. Status / pleasantries: "doing good", "I'm good", "great", "fine"
    const isStatus = [
      'doing good', 'doing well', 'im good', 'i am good', 'im doing good', 'im doing well',
      'i am doing well', 'pretty good', 'all good', 'doing great', 'im great', 'i am great',
      'im fine', 'i am fine', 'im ok', 'i am ok', 'not bad', 'just chilling', 'chilling',
      'good thanks', 'fine thanks', 'fine', 'good', 'great'
    ].some(sp => clean === sp || clean.startsWith(sp + ' '));

    if (isStatus) {
      if (tone === 'STRICT') {
        return `Good. What's our next focus item today?`;
      } else if (tone === 'BUBBLY') {
        return `Awesome! So glad to hear! ✨ What are we diving into today?`;
      } else {
        return `Glad to hear that! How can I help you today? Whenever you're ready, we can start mapping out your path, or we can just chat about what you're hoping to achieve.`;
      }
    }

    // 3. Thanks
    if (clean.includes('thanks') || clean.includes('thank')) {
      if (tone === 'STRICT') {
        return `You're welcome. Let's convert that into execution. What's next?`;
      } else if (tone === 'BUBBLY') {
        return `You're so welcome! ✨ Always happy to help! Let me know what we're tackling next! 🚀`;
      } else {
        return `Happy to help! Let me know whenever you want to dig into a topic or review your progress.`;
      }
    }

    // 4. Goodbye
    if (clean.includes('bye') || clean.includes('goodnight') || clean.includes('good night') || clean === 'see ya') {
      if (tone === 'STRICT') {
        return `Catch you later. Remember your commitments. Stay focused.`;
      } else if (tone === 'BUBBLY') {
        return `Bye bye! 👋 Have an awesome rest of your day! Talk soon! ✨`;
      } else {
        return `Take care! Reach out whenever you're ready to get back into it. Have a great day!`;
      }
    }

    // 5. Default Greetings (Hi, Hello, Hey, Hi Lucy)
    if (tone === 'STRICT') {
      return `Hey. Good to connect. How are you doing today?`;
    } else if (tone === 'BUBBLY') {
      return `Heyyy! ✨ Great to meet you! How are you doing today?`;
    } else {
      return `Hey! Nice to meet you. How are you doing today?`;
    }
  }
}
