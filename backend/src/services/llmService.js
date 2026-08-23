const axios = require('axios');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function client() {
  return axios.create({
    baseURL: ANTHROPIC_URL,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 15000,
  });
}

function safeParseJSON(text) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

// Pre-visit: urgency + chief complaint + suggested questions for the doctor.
// Never throws — on any failure it returns a safe fallback so booking still succeeds.
async function generatePreVisitSummary(symptoms) {
  const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}\n\nRespond ONLY with JSON in this exact shape, no preamble, no markdown fences:\n{"urgency": "Low|Medium|High", "chiefComplaint": "string", "suggestedQuestions": ["q1", "q2", "q3"]}`;

  try {
    const res = await client().post('', {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = (res.data.content || []).find((b) => b.type === 'text');
    const parsed = textBlock ? safeParseJSON(textBlock.text) : null;
    if (!parsed) throw new Error('LLM returned unparsable response');
    return {
      urgency: parsed.urgency || 'Unknown',
      chiefComplaint: parsed.chiefComplaint || symptoms.slice(0, 140),
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
      generatedAt: new Date(),
      llmFailed: false,
    };
  } catch (err) {
    console.error('[llmService] pre-visit summary failed:', err.message);
    return {
      urgency: 'Unknown',
      chiefComplaint: symptoms.slice(0, 140),
      suggestedQuestions: [],
      generatedAt: new Date(),
      llmFailed: true,
    };
  }
}

// Post-visit: turns clinical notes into a patient-friendly summary + medication schedule + follow-up.
async function generatePostVisitSummary(notes) {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}\n\nRespond ONLY with JSON in this exact shape, no preamble, no markdown fences:\n{"summary": "string", "medicationSchedule": "string", "followUpSteps": "string"}`;

  try {
    const res = await client().post('', {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = (res.data.content || []).find((b) => b.type === 'text');
    const parsed = textBlock ? safeParseJSON(textBlock.text) : null;
    if (!parsed) throw new Error('LLM returned unparsable response');
    return {
      summary: parsed.summary || notes.slice(0, 300),
      medicationSchedule: parsed.medicationSchedule || '',
      followUpSteps: parsed.followUpSteps || '',
      generatedAt: new Date(),
      llmFailed: false,
    };
  } catch (err) {
    console.error('[llmService] post-visit summary failed:', err.message);
    return {
      summary: notes.slice(0, 300),
      medicationSchedule: '',
      followUpSteps: '',
      generatedAt: new Date(),
      llmFailed: true,
    };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
