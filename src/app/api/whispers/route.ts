import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

const MNEMO_MODEL = process.env.MNEMO_MODEL ?? 'gpt-5';

const MNEMO_INSTRUCTIONS = `You are Mnemo, a silent supervisor agent watching a live standup meeting.
You never speak into the call. You whisper short text instructions to Scriber, the facilitator agent.

Your job:
1. Read the conversation context Scriber sends you.
2. Cross-reference it against prior standup history (provided in memory).
3. Identify ONE concrete, actionable signal Scriber should surface:
   - A blocker mentioned today that's a repeat from a prior standup
   - A commitment from a prior standup that hasn't been addressed
   - A topic that's overdue for discussion (e.g., a ticket sitting in "blocked" for over a week)
   - A connection between two threads in the current standup

Behavioral rules:
- Respond with the literal string "PASS" if there's nothing substantive to surface. Don't whisper for the sake of whispering.
- If you do whisper, keep it to ONE sentence — terse, actionable, citing a specific date or ticket where possible.
- Never speculate. Only use what's in the provided memory and the conversation context.

Output format: either "PASS" or one sentence of whisper text. No preamble, no explanation.`;

let _memoryCache: string | null = null;
async function loadMemory(): Promise<string> {
  if (_memoryCache) return _memoryCache;
  const p = path.join(process.cwd(), 'mnemo', 'memory.json');
  _memoryCache = await fs.readFile(p, 'utf-8');
  return _memoryCache;
}

export async function POST(req: NextRequest) {
  try {
    const { context } = await req.json();
    if (!context || typeof context !== 'string') {
      return NextResponse.json({ whisper: null, reason: 'no context provided' });
    }

    const memory = await loadMemory();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.create({
      model: MNEMO_MODEL,
      input: [
        { role: 'system', content: MNEMO_INSTRUCTIONS },
        { role: 'system', content: `Prior standup memory (JSON):\n${memory}` },
        { role: 'user', content: `Scriber asks: ${context}\n\nWhisper one sentence or PASS.` },
      ],
      reasoning: { effort: 'medium' },
    } as any);

    const text = (response as any).output_text?.trim() ?? '';
    if (!text || text.toUpperCase() === 'PASS') {
      return NextResponse.json({ whisper: null });
    }
    return NextResponse.json({ whisper: text });
  } catch (e: any) {
    console.error('mnemo whisper error', e?.message ?? e);
    return NextResponse.json({ whisper: null, error: e?.message ?? 'whisper failed' });
  }
}
