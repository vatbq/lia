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
  existingActionItems: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      completed: z.boolean(),
    })
  ),
  existingInsights: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(["positive", "negative", "neutral", "warning"]),
    })
  ),
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
  allActionItems: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      completed: z.boolean(),
      timestamp: z.string().optional(),
    })
  ),
  allInsights: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(["positive", "negative", "neutral", "warning"]),
      timestamp: z.string().optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { tasks, transcription, existingActionItems, existingInsights } = requestSchema.parse(body);

    // Prepare the context for the AI
    const conversationText = transcription;

    const tasksText = tasks.map((task: any) => `- ${task.id}: ${task.title}${task.description ? ` - ${task.description}` : ""}`).join("\n");

    const existingActionItemsText = existingActionItems.length > 0 ? existingActionItems.map((item: any) => `- ${item.title}${item.description ? `: ${item.description}` : ""}`).join("\n") : "None";

    const existingInsightsText = existingInsights.length > 0 ? existingInsights.map((insight: any) => `- [${insight.type}] ${insight.title}: ${insight.description}`).join("\n") : "None";

    console.log("existingActionItemsText", existingActionItemsText);
    console.log("existingInsightsText", existingInsightsText);

    const prompt = `You are an intelligent task and conversation analyzer. Your job is to carefully analyze the conversation transcript and determine the status of existing tasks, extract new action items, and generate valuable insights.

# CONVERSATION TRANSCRIPT
${conversationText}

# EXISTING TASKS TO ANALYZE
${tasksText}

# EXISTING ACTION ITEMS (DO NOT DUPLICATE THESE)
${existingActionItemsText}

# EXISTING INSIGHTS (DO NOT DUPLICATE THESE)
${existingInsightsText}

# YOUR RESPONSIBILITIES

## 1. TASK STATUS ANALYSIS
For each task in the list above, carefully determine if it has been completed based on the conversation.

**Completion Criteria (mark as completed if ANY of these apply):**
- Task is explicitly marked as done, finished, completed, or accomplished
- Clear evidence that the task's objective has been fully achieved (e.g., "sent the email", "uploaded the file", "called the client")
- Someone confirms the task is complete using past tense or completion language (e.g., "I did X", "finished X", "X is ready", "X is sent")
- Someone is showing off, demonstrating, or presenting the completed work (e.g., "look at this", "here's what I made", "check out", "let me show you")

**NOT Completed (only mark as incomplete if):**
- No mention of the task at all in the conversation
- Clear indication that the task failed or wasn't completed

**For each task provide:**
- \`id\`: The exact task ID from the list above
- \`completed\`: true/false based on the criteria
- \`message\`: If completed, explain what was done and how you know it's complete (2-3 sentences). If not completed, provide an empty string "".

## 2. COMPLETE ACTION ITEMS LIST
Return ALL action items (existing + new ones from conversation). Include existing action items with their current properties, and add any new action items mentioned in the conversation.

**For existing action items:** Keep them as-is with their current properties
**For new action items:** Look for:
- **Explicitly committed with clear ownership**: Someone specifically said "I will...", "I'll...", "I need to...", "We must..."
- **Scheduled or time-bound**: Mentions a specific date, time, deadline, or scheduling requirement
- **Concrete and specific**: Has a clear deliverable or outcome
- **Future-oriented**: Something that needs to be done after this conversation

**For each action item provide:**
- \`id\`: Use existing ID or generate a unique ID (use format: "action-[timestamp]-[random]")
- \`title\`: Clear, concise action title (5-10 words)
- \`description\`: More detailed context about what needs to be done and why
- \`priority\`:
  - "high": Urgent, time-sensitive, or critical impact
  - "medium": Important but not urgent, standard priority
  - "low": Nice to have, can be deferred
- \`completed\`: Current completion status

## 3. COMPLETE INSIGHTS LIST
Return ALL insights (existing + new ones from conversation). Include existing insights and add any new meaningful insights about the conversation.

**For existing insights:** Keep them as-is with their current properties
**For new insights:** Generate ONLY **EXCEPTIONAL** insights that represent MAJOR developments or critical information.

**When to Generate Insights (VERY RARELY):**
- MAJOR project milestones completed
- SIGNIFICANT strategic decisions made

**Insight Types (use only for exceptional cases):**
- \`positive\`: Major achievements, critical wins, significant completed goals
- \`negative\`: Serious problems, major failures, critical blockers
- \`warning\`: High-risk situations, serious red flags, urgent concerns
- \`neutral\`: Major strategic decisions, significant pivots

**For each insight provide:**
- \`id\`: Use existing ID or generate a unique ID (use format: "insight-[timestamp]-[random]")
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
  "allActionItems": [
    {
      "id": "existing-or-new-action-id",
      "title": "Action title",
      "description": "Description of what needs to be done",
      "priority": "high",
      "completed": false
    }
  ],
  "allInsights": [
    {
      "id": "existing-or-new-insight-id",
      "title": "Insight title",
      "description": "Detailed explanation of the insight with context and implications",
      "type": "positive"
    }
  ]
}

# IMPORTANT NOTES
- Be thorough but accurate - only mark tasks as completed if there's clear evidence
- Generate IDs that are unique and won't collide (use timestamp + random string)
- Use professional, clear language in all messages and descriptions
- All existing tasks MUST be included in the response with their status
- **RETURN COMPLETE LISTS:** The allActionItems and allInsights arrays should contain ALL items (existing + new). Include existing items with their current properties and add any new items from the conversation.
- **NO DUPLICATES:** Each item should have a unique ID. Don't create multiple items with the same or very similar content.
`;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash-lite"),
      schema: responseSchema,
      prompt: prompt,
    });

    // Add timestamps to each insight and action item
    const currentTime = new Date().toISOString();
    const objectWithTimestamps = {
      ...object,
      allInsights: object.allInsights.map((insight) => ({
        ...insight,
        timestamp: insight.timestamp || currentTime,
      })),
      allActionItems: object.allActionItems.map((item) => ({
        ...item,
        timestamp: item.timestamp || currentTime,
      })),
    };

    return NextResponse.json(objectWithTimestamps);
  } catch (error: any) {
    console.error("Error analyzing tasks:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
