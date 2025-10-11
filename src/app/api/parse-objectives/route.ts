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
  priority: z.number().min(1).max(5),
});

const OpenIAResponseSchema = z.object({
  objectives: z.array(Objective),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { context, objectives } = RequestSchema.parse(json);

    const prompt = `You are an assistant helping to prepare a call. Given the user's context and raw objectives, rewrite the objectives as a clear, concise, prioritized checklist. Each item should be actionable and unambiguous.

Context:
${context}

Raw Objectives:
${objectives}

Return JSON with:
- objectives: array of objects with {name: string, description: string, priority: number (1-5 where 1 is highest)}`;

    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: zodTextFormat(OpenIAResponseSchema, "objectives"),
      },
    });

    const text = response.output_text || "{}";

    // Clean the text to remove any potential markdown code blocks or extra whitespace
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", cleanedText);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate with schema
    const validated = OpenIAResponseSchema.parse(parsed);

    return new Response(JSON.stringify({ ok: true, data: validated }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Error in parse-objectives:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
