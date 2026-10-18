import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Available and supported Gemini Flash models in priority order
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite'
];

const REQUEST_TIMEOUT_MS = 30000;
const MAX_MESSAGE_LENGTH = 4000;

// Mentor definitions for server-side system prompts
const MENTOR_CONFIGS: Record<string, {
  name: string;
  domain: string;
  tagline: string;
  bio: string;
  profileQuote: string;
}> = {
  AARYA: {
    name: 'Aarya',
    domain: 'AI_ML',
    tagline: 'AI & Machine Learning Specialist',
    bio: 'Guides students through Python, linear algebra, deep learning, PyTorch projects, and AI careers. Pragmatic, intuition-first, emphasizes hands-on code.',
    profileQuote: "Let's figure out what you actually want to build with AI."
  },
  ALEX: {
    name: 'Alex',
    domain: 'CYBERSECURITY',
    tagline: 'Offensive & Defensive Security Specialist',
    bio: 'Guides students through Linux CLI, networking protocols, ethical hacking, OWASP Top 10, TryHackMe labs, and security certs. Analytical and security-minded.',
    profileQuote: "Curious how systems break? Let's start there."
  },
  LUCY: {
    name: 'Lucy',
    domain: 'DATA_SCIENCE',
    tagline: 'Data Analytics & Business Intelligence Specialist',
    bio: 'Guides students through SQL querying, Python Pandas, EDA, business intelligence dashboards, and storytelling. Practical and business-impact driven.',
    profileQuote: "Let's turn your data questions into a career you can actually build."
  }
};

const PERSONALITY_CONFIGS: Record<string, {
  title: string;
  toneSummary: string;
}> = {
  FRIENDLY: {
    title: 'Friendly',
    toneSummary: 'Warm, patient, supportive, encouraging, conversational.'
  },
  STRICT: {
    title: 'Strict',
    toneSummary: 'Direct, honest, accountable, firm, zero fluff, focuses on execution and high standards.'
  },
  BUBBLY: {
    title: 'Bubbly',
    toneSummary: 'High energy, playful, enthusiastic, uses emojis, celebrates small wins.'
  }
};

const VALID_ACTION_TYPES = [
  'NONE',
  'UPDATE_PROFILE',
  'CREATE_COMMITMENT',
  'PROPOSE_ROADMAP',
  'ADVANCE_DAY',
  'TAKE_QUIZ'
];

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // 2. Server-side Authentication & Caller Identity Verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized: Missing or invalid Authorization header'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://lfzdstodflyprsptelqy.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Verify user JWT against Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized: Invalid or expired token',
        details: userError?.message
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Request Payload Parsing & Validation
    let reqBody: any = {};
    try {
      reqBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Bad Request: Malformed JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message: string = (reqBody.message || reqBody.prompt || '').trim();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Bad Request: "message" or "prompt" is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({
        error: `Bad Request: Message length (${message.length}) exceeds maximum allowed (${MAX_MESSAGE_LENGTH})`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Retrieve Authoritative Student Context Server-Side using user.id
    // Never blindly trust client-supplied state; Supabase is the single source of truth.
    const [profileRes, memoriesRes, commitmentsRes, roadmapRes] = await Promise.all([
      userClient
        .from('profiles')
        .select('full_name, target_role, experience_level, learning_style, active_mentor_id, personality, onboarding_step, onboarding_completed, education, weekly_hours, interests')
        .eq('user_id', user.id)
        .maybeSingle(),
      userClient
        .from('memories')
        .select('key_category, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      userClient
        .from('commitments')
        .select('id, statement, action, target_window, status, due_at')
        .eq('user_id', user.id)
        .in('status', ['PENDING', 'REMINDING', 'IN_PROGRESS'])
        .order('created_at', { ascending: false })
        .limit(5),
      userClient
        .from('roadmaps')
        .select('id, domain, title, current_day, status, stages')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const profile = profileRes.data;
    const memories = memoriesRes.data || [];
    const commitments = commitmentsRes.data || [];
    const roadmap = roadmapRes.data;

    // Fetch current day mission task and quiz state if active roadmap exists
    let dayTaskStatus = 'NOT_STARTED';
    let dayQuizStatus = 'NOT_ATTEMPTED';
    if (roadmap) {
      const [accRes, quizRes] = await Promise.all([
        userClient
          .from('mission_accountability')
          .select('status, is_completed')
          .eq('user_id', user.id)
          .eq('roadmap_id', roadmap.id)
          .eq('day_number', roadmap.current_day)
          .maybeSingle(),
        userClient
          .from('quiz_attempts')
          .select('score, passed')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (accRes.data) {
        dayTaskStatus = accRes.data.is_completed ? 'COMPLETED' : accRes.data.status || 'IN_PROGRESS';
      }
      if (quizRes.data) {
        dayQuizStatus = quizRes.data.passed ? `PASSED (${quizRes.data.score}%)` : `FAILED (${quizRes.data.score}%)`;
      }
    }

    // Fetch verified conversation history if conversationId provided
    // Fetch verified conversation history from database
    const conversationHistory: Array<{ sender: string; text: string }> = [];
    let targetConversationId = reqBody.conversationId;

    if (!targetConversationId) {
      const { data: latestConv } = await userClient
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestConv) {
        targetConversationId = latestConv.id;
      }
    }

    if (targetConversationId) {
      const { data: conv } = await userClient
        .from('conversations')
        .select('id')
        .eq('id', targetConversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (conv) {
        const { data: msgs } = await userClient
          .from('messages')
          .select('sender, text')
          .eq('conversation_id', targetConversationId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6);
        if (msgs) {
          conversationHistory.push(...msgs.reverse());
        }
      }
    }

    // 5. Mentor Identity & Personality Setup - strictly validated against whitelist
    const validMentors = ['AARYA', 'ALEX', 'LUCY'];
    const validPersonalities = ['FRIENDLY', 'STRICT', 'BUBBLY'];

    let mentorKey = (typeof reqBody.mentorId === 'string' ? reqBody.mentorId.trim().toUpperCase() : '');
    if (!validMentors.includes(mentorKey)) {
      mentorKey = (profile?.active_mentor_id && validMentors.includes(profile.active_mentor_id.toUpperCase()))
        ? profile.active_mentor_id.toUpperCase()
        : 'AARYA';
    }
    const mentor = MENTOR_CONFIGS[mentorKey] || MENTOR_CONFIGS.AARYA;

    let personalityKey = (typeof reqBody.personality === 'string' ? reqBody.personality.trim().toUpperCase() : '');
    if (!validPersonalities.includes(personalityKey)) {
      personalityKey = (profile?.personality && validPersonalities.includes(profile.personality.toUpperCase()))
        ? profile.personality.toUpperCase()
        : 'FRIENDLY';
    }
    const personality = PERSONALITY_CONFIGS[personalityKey] || PERSONALITY_CONFIGS.FRIENDLY;

    // Build Compact Context Summary
    const studentSummary = [
      `Name: ${profile?.full_name || 'Student'}`,
      `Target Role: ${profile?.target_role || 'Not specified'}`,
      `Level: ${profile?.experience_level || 'Beginner'}`,
      `Education: ${profile?.education || 'College Student'}`,
      `Learning Style: ${profile?.learning_style || 'Hands-on'}`,
      `Weekly Hours: ${profile?.weekly_hours || 'Flexible'}`,
      `Interests: ${profile?.interests || 'General'}`
    ].join(' | ');

    const memoriesSummary = memories.length > 0
      ? memories.map(m => `- [${m.key_category}]: ${m.content}`).join('\n')
      : 'None logged yet';

    const commitmentsSummary = commitments.length > 0
      ? commitments.map(c => `- ${c.statement || c.action} (Status: ${c.status}, Due: ${c.target_window || c.due_at || 'soon'})`).join('\n')
      : 'None active';

    const roadmapSummary = roadmap
      ? `Active Roadmap: "${roadmap.title}" | Current Day: ${roadmap.current_day} | Day Task: ${dayTaskStatus} | Day Quiz: ${dayQuizStatus}`
      : 'No active roadmap';

    const systemPrompt = `You are ${mentor.name}, a dedicated engineering mentor in ${mentor.tagline} at Mentor Broski.
Tone & Style: ${personality.title} (${personality.toneSummary}).
Bio & Approach: ${mentor.bio}
Motto: "${mentor.profileQuote}"

Core Guidelines:
1. Embody ${mentor.name} with ${personality.title} communication style authentically. Never break character.
2. Provide concise, clear, motivating, and technically sound guidance.
3. Tailor explanations to the student's background and roadmap progress.
4. If the student explicitly wants to commit to a study session or asks for a reminder, propose CREATE_COMMITMENT.
5. If the student asks for a study plan or roadmap, set suggestPlan: true and propose PROPOSE_ROADMAP.
6. If the student shares new profile info (e.g. target role, experience level), propose UPDATE_PROFILE.
7. If the student indicates they finished their day's mission and passed the quiz, propose ADVANCE_DAY.
8. NEVER execute database writes directly. Propose structured actions according to the JSON schema.

Authoritative Student Context (Verified Server-Side):
[Profile]: ${studentSummary}
[Memories]:
${memoriesSummary}
[Commitments]:
${commitmentsSummary}
[Roadmap & Progress]:
${roadmapSummary}

OUTPUT REQUIREMENTS:
You MUST respond with a valid JSON object matching this schema:
{
  "reply": "Your mentor response to the student as ${mentor.name}",
  "suggestPlan": false,
  "proposedAction": {
    "type": "NONE",
    "payload": {}
  }
}
Where "proposedAction.type" can be: "NONE" | "UPDATE_PROFILE" | "CREATE_COMMITMENT" | "PROPOSE_ROADMAP" | "ADVANCE_DAY" | "TAKE_QUIZ".`;

    // 6. Retrieve GEMINI_API_KEY from Edge Function Secrets or server_vault fallback
    let apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey && serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: vaultRow } = await adminClient
        .from('server_vault')
        .select('value')
        .eq('key', 'GEMINI_API_KEY')
        .maybeSingle();
      if (vaultRow && vaultRow.value) {
        apiKey = vaultRow.value;
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'Configuration Error: GEMINI_API_KEY is not configured in Edge Function Secrets or server_vault'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 7. Build Gemini Request Payload with History & JSON generationConfig
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // History (from verified DB exclusively for authenticated user)
    const historySource = conversationHistory;
    for (const item of historySource) {
      if (item.text && (item.sender === 'user' || item.sender === 'mentor' || item.role === 'user' || item.role === 'model')) {
        contents.push({
          role: (item.sender === 'user' || item.role === 'user') ? 'user' : 'model',
          parts: [{ text: item.text }]
        });
      }
    }

    // Current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: typeof reqBody.temperature === 'number' ? reqBody.temperature : 0.7,
        maxOutputTokens: typeof reqBody.maxOutputTokens === 'number' ? reqBody.maxOutputTokens : 1024
      }
    };

    // 8. Execute Gemini Request with Bounded Timeout & Model Fallback
    let lastError: any = null;
    let selectedModel = GEMINI_MODELS[0];
    let geminiResponseData: any = null;

    for (const model of GEMINI_MODELS) {
      selectedModel = model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (geminiRes.ok) {
          geminiResponseData = await geminiRes.json();
          break; // Success!
        } else {
          const errorText = await geminiRes.text();
          lastError = { model, status: geminiRes.status, body: errorText };

          if (geminiRes.status === 404 || geminiRes.status === 503) {
            console.warn(`Model ${model} returned ${geminiRes.status}, falling back to next available model...`);
            continue;
          }
          break;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = { model, message: err.message || 'Fetch error' };
        if (err.name === 'AbortError') {
          return new Response(JSON.stringify({
            error: `Gateway Timeout: Gemini API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`
          }), {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    if (!geminiResponseData) {
      console.error('Gemini API call failed:', lastError);
      return new Response(JSON.stringify({
        error: 'Gemini API Error: Failed to generate response',
        details: lastError
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 9. Extract and Validate Structured Output from Gemini Response
    const candidate = geminiResponseData.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason || 'STOP';

    let replyText = '';
    let suggestPlan = false;
    let proposedAction: any = { type: 'NONE' };

    const tryParse = (src: string): any => {
      const t = src.trim();
      // Direct parse
      try { const p = JSON.parse(t); if (p && typeof p === 'object') return p; } catch { /* continue */ }
      // Markdown code fences
      const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fence && fence[1]) {
        try { const p = JSON.parse(fence[1].trim()); if (p && typeof p === 'object') return p; } catch { /* continue */ }
      }
      // First '{' to last '}'
      const fb = t.indexOf('{'), lb = t.lastIndexOf('}');
      if (fb !== -1 && lb > fb) {
        try { const p = JSON.parse(t.slice(fb, lb + 1)); if (p && typeof p === 'object') return p; } catch { /* continue */ }
      }
      return null;
    };

    const parsed = tryParse(rawText);
    if (parsed) {
      // Extract reply — unwrap nested JSON if Gemini double-wrapped
      let rawReply = parsed.reply || parsed.text || '';
      if (typeof rawReply === 'string') {
        rawReply = rawReply.trim();
        if (rawReply.startsWith('{') && rawReply.includes('"reply"')) {
          const nested = tryParse(rawReply);
          if (nested && typeof nested.reply === 'string') rawReply = nested.reply.trim();
        }
      }
      replyText = typeof rawReply === 'string' ? rawReply : rawText;
      suggestPlan = Boolean(parsed.suggestPlan);
      if (parsed.proposedAction && typeof parsed.proposedAction === 'object') {
        const actionType = String(parsed.proposedAction.type || 'NONE').toUpperCase();
        if (VALID_ACTION_TYPES.includes(actionType)) {
          proposedAction = { type: actionType, payload: parsed.proposedAction.payload || {} };
        }
      }
    } else {
      // Gemini returned plain text (non-JSON) — use as-is, no action
      replyText = rawText;
      suggestPlan = false;
      proposedAction = { type: 'NONE' };
    }

    // Final safety guard: if replyText still looks like a JSON blob, extract reply field
    if (replyText && replyText.trim().startsWith('{') && replyText.includes('"reply"')) {
      const m = replyText.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (m && m[1]) {
        replyText = m[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
      }
    }


    return new Response(JSON.stringify({
      success: true,
      text: replyText,
      suggestPlan,
      proposedAction,
      model: selectedModel,
      userId: user.id,
      mentorId: mentor.name.toUpperCase(),
      personality: personality.title.toUpperCase(),
      finishReason,
      usage: geminiResponseData.usageMetadata || null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Unhandled exception in chat edge function:', err);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: err.message || 'Unexpected failure'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
