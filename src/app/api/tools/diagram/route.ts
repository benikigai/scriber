import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { attachBytesToIssue } from '@/lib/linearAttach';

const IMAGE_MODEL = process.env.IMAGE_MODEL ?? 'gpt-image-1';
const DIAGRAM_STYLE_PREFIX =
  'Flat technical diagram with labeled boxes and arrows. Clean, professional. White background, dark text, single accent color. No photorealism. ';

async function fallbackBytes(): Promise<Buffer | null> {
  try {
    const p = path.join(process.cwd(), 'public', 'fallback-diagram.png');
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { prompt, attach_to_issue } = await req.json().catch(() => ({}));
  if (!prompt || !attach_to_issue) {
    return NextResponse.json({ error: 'prompt and attach_to_issue required' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fullPrompt = DIAGRAM_STYLE_PREFIX + prompt;
  let bytes: Buffer | null = null;
  let usedFallback = false;

  try {
    const img = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: fullPrompt,
      size: '1024x1024',
      quality: 'low',
      output_format: 'jpeg',
      n: 1,
    } as any);
    const b64 = img.data?.[0]?.b64_json;
    if (b64) {
      bytes = Buffer.from(b64, 'base64');
    } else {
      console.warn('gpt-image-1 returned no b64_json — using fallback');
    }
  } catch (e: any) {
    console.warn('gpt-image-1 generate failed, using fallback:', e?.message);
  }

  if (!bytes) {
    bytes = await fallbackBytes();
    usedFallback = true;
  }
  if (!bytes) {
    return NextResponse.json(
      { error: 'image generation failed and no fallback available' },
      { status: 500 },
    );
  }

  const contentType = usedFallback ? 'image/png' : 'image/jpeg';
  const filename = usedFallback ? 'diagram-fallback.png' : `diagram-${Date.now()}.jpg`;
  const title = prompt.slice(0, 80);

  try {
    const { assetUrl } = await attachBytesToIssue({
      issueIdentifier: attach_to_issue,
      bytes,
      filename,
      contentType,
      title,
    });
    return NextResponse.json({
      success: true,
      attached_to: attach_to_issue,
      asset_url: assetUrl,
      used_fallback: usedFallback,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'attach failed', used_fallback: usedFallback }, { status: 500 });
  }
}
