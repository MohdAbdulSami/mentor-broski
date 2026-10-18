const testInputs = [
  // 1. Raw JSON
  '{\n  "reply": "Awesome! Here is your roadmap.",\n  "suggestPlan": true,\n  "proposedAction": {\n    "type": "PROPOSE_ROADMAP",\n    "payload": {\n      "durationDays": 30,\n      "focus": "AI Foundations"\n    }\n  }\n}',

  // 2. Markdown fenced JSON
  '```json\n{\n  "reply": "Let\'s dive in!",\n  "suggestPlan": true,\n  "proposedAction": {\n    "type": "PROPOSE_ROADMAP"\n  }\n}\n```',

  // 3. Markdown fenced with leading/trailing chatter
  'Here is the response:\n```json\n{\n  "reply": "Let\'s get started!",\n  "suggestPlan": false,\n  "proposedAction": {\n    "type": "NONE"\n  }\n}\n```\nHope that helps!',

  // 4. Malformed JSON (missing closing brace or trailing comma)
  '{\n  "reply": "Hello there! Let\'s work on your plan.",\n  "suggestPlan": true,\n  "proposedAction": {\n    "type": "PROPOSE_ROADMAP",\n  }\n',

  // 5. Normal text (not JSON)
  'Hey student, I am ready when you are! What would you like to build first?'
];

export function extractStructuredResponse(raw) {
  if (!raw || typeof raw !== 'string') {
    return { reply: '', suggestPlan: false, proposedAction: { type: 'NONE' } };
  }

  const trimmed = raw.trim();

  // Try direct parse first
  try {
    const direct = JSON.parse(trimmed);
    if (direct && typeof direct === 'object') {
      return sanitizeParsedObject(direct, trimmed);
    }
  } catch {}

  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  let cleaned = trimmed;
  if (cleaned.includes('```')) {
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      cleaned = fenceMatch[1].trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object') {
          return sanitizeParsedObject(parsed, cleaned);
        }
      } catch {}
    }
  }

  // Extract from first '{' to last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed === 'object') {
        return sanitizeParsedObject(parsed, jsonCandidate);
      }
    } catch {}

    // Fallback: regex extraction for "reply" field if JSON is slightly malformed (e.g. unescaped newlines or trailing commas)
    const replyMatch = jsonCandidate.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (replyMatch && replyMatch[1]) {
      const extractedReply = replyMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');

      const suggestPlanMatch = jsonCandidate.match(/"suggestPlan"\s*:\s*(true|false)/i);
      const actionTypeMatch = jsonCandidate.match(/"type"\s*:\s*"([A-Z_]+)"/);

      return {
        reply: extractedReply.trim(),
        suggestPlan: suggestPlanMatch ? suggestPlanMatch[1].toLowerCase() === 'true' : false,
        proposedAction: actionTypeMatch ? { type: actionTypeMatch[1], payload: {} } : { type: 'NONE' }
      };
    }
  }

  // If not JSON or completely unparseable, ensure we NEVER display a raw JSON object string to the user!
  if (trimmed.startsWith('{') && trimmed.includes('"reply"')) {
    // Aggressive regex fallback on original string
    const match = trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (match && match[1]) {
      return {
        reply: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim(),
        suggestPlan: trimmed.includes('"suggestPlan": true') || trimmed.includes('"suggestPlan":true'),
        proposedAction: { type: 'NONE' }
      };
    }
  }

  // Normal plain text response
  return {
    reply: trimmed,
    suggestPlan: false,
    proposedAction: { type: 'NONE' }
  };
}

function sanitizeParsedObject(obj, fallbackRaw) {
  let reply = '';
  if (typeof obj.reply === 'string') {
    reply = obj.reply.trim();
  } else if (typeof obj.text === 'string') {
    reply = obj.text.trim();
  } else if (typeof obj.message === 'string') {
    reply = obj.message.trim();
  }

  // Defensive: if reply itself was somehow serialized as JSON string or empty
  if (!reply || (reply.startsWith('{') && reply.endsWith('}') && reply.includes('"reply"'))) {
    try {
      const nested = JSON.parse(reply);
      if (nested && typeof nested.reply === 'string') {
        reply = nested.reply.trim();
      }
    } catch {}
  }

  const suggestPlan = Boolean(obj.suggestPlan);
  let proposedAction = { type: 'NONE' };
  if (obj.proposedAction && typeof obj.proposedAction === 'object') {
    const actionType = String(obj.proposedAction.type || 'NONE').toUpperCase();
    proposedAction = {
      type: actionType,
      payload: obj.proposedAction.payload || {}
    };
  }

  return { reply, suggestPlan, proposedAction };
}

console.log('Running parser tests...');
for (let i = 0; i < testInputs.length; i++) {
  const result = extractStructuredResponse(testInputs[i]);
  console.log(`\n--- Test Case ${i + 1} ---`);
  console.log('Reply:', result.reply);
  console.log('Suggest Plan:', result.suggestPlan);
  console.log('Proposed Action:', JSON.stringify(result.proposedAction));
  if (result.reply.startsWith('{') || result.reply.includes('"reply":')) {
    console.error('ERROR: Leaked JSON in reply!');
  } else {
    console.log('✓ Clean conversational reply');
  }
}
