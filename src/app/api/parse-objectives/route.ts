import { NextRequest } from "next/server";
import { z } from "zod/v3";
import { getOpenAIClient } from "@/lib/openai";
import { zodTextFormat } from "openai/helpers/zod";

const RequestSchema = z.object({
  context: z.string().min(1),
  objectives: z.string().min(1),
});


const Objective = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.number(),
});
    
const OpenIAResponseSchema = z.object({
  context: z.string(),
  objectives: z.array(Objective),
});


export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { context, objectives } = RequestSchema.parse(json);

    const prompt = `You are an assistant helping to prepare a call. Given the user's context and raw objectives, rewrite the objectives as a clear, concise, prioritized checklist. Each item should be actionable and unambiguous. Also extract key constraints and risks.

Context:\n${context}\n\nRaw Objectives:\n${objectives}\n\nReturn JSON with keys: objectives (array of strings), constraints (array of strings), risks (array of strings).`;

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: zodTextFormat(OpenIAResponseSchema, "objectives"),
      },
    });

    const text = response.output_text || "{}";
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}


