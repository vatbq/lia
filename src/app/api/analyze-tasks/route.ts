import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schema to validate input
const requestSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
    })
  ),
  transcription: z.string(),
});

// Schema for the response
const responseSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      completed: z.boolean(),
      message: z.string().optional(),
    })
  ),
  actionItems: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      completed: z.boolean(),
      timestamp: z.string().default(new Date().toISOString()),
    })
  ),
  insights: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(["positive", "negative", "neutral", "warning"]),
      timestamp: z.string().default(new Date().toISOString()),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { tasks, transcription } = requestSchema.parse(body);

    // Prepare the context for the AI
    const conversationText = transcription;

    const tasksText = tasks.map((task: any) => `- ${task.id}: ${task.title}${task.description ? ` - ${task.description}` : ""}`).join("\n");

    const prompt = `You are an intelligent task and conversation analyzer. Your job is to carefully analyze the conversation transcript and determine the status of existing tasks, extract new action items, and generate valuable insights.

# CONVERSATION TRANSCRIPT
${conversationText}

# EXISTING TASKS TO ANALYZE
${tasksText}

# YOUR RESPONSIBILITIES

## 1. TASK STATUS ANALYSIS
For each task in the list above, carefully determine if it has been completed based on the conversation.

**Completion Criteria:**
- Task is explicitly marked as done, finished, or completed in the conversation
- The conversation contains clear evidence that the task's objective has been fully achieved
- Someone explicitly confirms the task is complete or accomplished

**NOT Completed:**
- Task is only discussed or mentioned without completion
- Task is in progress but not finished
- Task is planned for the future
- Partial completion (unless explicitly stated as "done")
- No mention of the task in the conversation

**For each task provide:**
- \`id\`: The exact task ID from the list above
- \`completed\`: true/false based on the criteria
- \`message\`: If completed, explain what was done and how you know it's complete (2-3 sentences). If not completed, provide an empty string "".

## 2. ACTION ITEMS EXTRACTION
Scan the conversation for NEW action items, tasks, or commitments that were discussed but are NOT in the existing task list.

**Look for:**
- Explicit commitments: "I'll...", "We need to...", "Let's...", "I will..."
- Decisions that require follow-up actions
- Problems mentioned that need solutions
- Deadlines or future tasks mentioned
- Scheduled activities or meetings
- Things people agreed to do

**Do NOT extract:**
- Vague or hypothetical discussions without commitment
- Tasks that are already in the existing task list
- General observations without actionable outcomes

**For each action item provide:**
- \`id\`: Generate a unique ID (use format: "action-[timestamp]-[random]")
- \`title\`: Clear, concise action title (5-10 words)
- \`description\`: More detailed context about what needs to be done and why
- \`priority\`:
  - "high": Urgent, time-sensitive, or critical impact
  - "medium": Important but not urgent, standard priority
  - "low": Nice to have, can be deferred
- \`completed\`: false (these are newly identified items)

## 3. INSIGHTS GENERATION
Generate 2-5 key insights about the conversation that provide value and context.

**Insight Types:**
- \`positive\`: Achievements, successes, good progress, wins, completed goals, positive outcomes
- \`negative\`: Problems, failures, setbacks, missed deadlines, blockers, concerns raised
- \`warning\`: Risks, potential issues, things to watch out for, red flags, concerning trends
- \`neutral\`: Important observations, decisions made, status updates, factual developments

**Quality Guidelines:**
- Be specific and reference concrete details from the conversation
- Focus on significant information, not trivial observations
- Provide context and implications, not just facts
- Each insight should add unique value

**For each insight provide:**
- \`id\`: Generate a unique ID (use format: "insight-[timestamp]-[random]")
- \`title\`: Concise insight summary (5-10 words)
- \`description\`: Detailed explanation with context and implications (2-4 sentences)
- \`type\`: Choose the most appropriate type from above

# RESPONSE FORMAT
Return your analysis in the following structure (all arrays, no nested objects):

{
  "tasks": [
    {
      "id": "existing-task-id",
      "completed": true,
      "message": "Explanation of completion with evidence from conversation"
    }
  ],
  "actionItems": [
    {
      "id": "action-123-abc",
      "title": "Short action title",
      "description": "Detailed description of what needs to be done",
      "priority": "high",
      "completed": false
    }
  ],
  "insights": [
    {
      "id": "insight-123-abc",
      "title": "Key insight title",
      "description": "Detailed explanation of the insight with context and implications",
      "type": "positive"
    }
  ]
}

# IMPORTANT NOTES
- Be thorough but accurate - only mark tasks as completed if there's clear evidence
- Generate IDs that are unique and won't collide (use timestamp + random string)
- Prioritize quality over quantity for insights - 2-3 excellent insights are better than 10 mediocre ones
- Use professional, clear language in all messages and descriptions
- If no action items or insights are found, return empty arrays
- All existing tasks MUST be included in the response with their status`;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: responseSchema,
      prompt: prompt,
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error("Error analyzing tasks:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
