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

## 2. ACTION ITEMS EXTRACTION
Scan the conversation for NEW action items that are SPECIFIC, COMMITTED, and NOT DUPLICATES.

**CRITICAL - DUPLICATE CHECK (MUST DO FIRST):**
1. Read through ALL existing action items carefully
2. For each potential new action item, ask: "Is this already captured or very similar to an existing item?"
3. If YES to any similarity, DO NOT create the action item
4. Only create action items that are completely NEW and distinct

**ONLY Extract Action Items That Are:**
- **Explicitly committed with clear ownership**: Someone specifically said "I will...", "I'll...", "I need to...", "We must..."
- **Scheduled or time-bound**: Mentions a specific date, time, deadline, or scheduling requirement (e.g., "meeting next Tuesday", "send by Friday", "schedule a call")
- **Concrete and specific**: Has a clear deliverable or outcome (e.g., "send the report to John", NOT "think about the report")
- **Future-oriented**: Something that needs to be done after this conversation

**ABSOLUTELY DO NOT Extract:**
- Vague statements without commitment (e.g., "we should maybe...", "it would be nice to...")
- Past tense actions already completed (e.g., "I sent the email")
- General ideas or discussions without clear next steps
- Anything already captured in existing tasks or existing action items
- Similar variations of existing action items (even with slightly different wording)
- Hypothetical scenarios or possibilities without commitment
- Questions or uncertainties without decisions
- General observations, complaints, or comments without actionable outcomes

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
Generate ONLY **EXCEPTIONAL** insights that represent MAJOR developments or critical information.

**CRITICAL RESTRICTIONS:**
- Review "EXISTING INSIGHTS" - DO NOT create similar or duplicate insights
- **DEFAULT TO EMPTY ARRAY** - Most conversations should generate ZERO new insights
- Only create insights for truly exceptional, high-impact information or if someone mentions that this is an insight.

**When to Generate Insights (VERY RARELY):**
- MAJOR project milestones completed
- SIGNIFICANT strategic decisions made

**DO NOT Generate Insights For:**
- Normal work progress or routine updates
- Minor issues or small problems
- Regular task completion (this goes in task status)
- General observations or thoughts mentioned
- Anything that's not exceptionally significant
- Information already in action items
- Discussions without major outcomes

**Insight Types (use only for exceptional cases):**
- \`positive\`: Major achievements, critical wins, significant completed goals
- \`negative\`: Serious problems, major failures, critical blockers
- \`warning\`: High-risk situations, serious red flags, urgent concerns
- \`neutral\`: Major strategic decisions, significant pivots

**Quality Guidelines (EXTREMELY STRICT):**
- **Maximum 0-1 insights per topic** (2 only in exceptional cases)
- Each insight must represent MAJOR new information
- If in doubt, DO NOT generate the insight
- Empty array is the correct answer most of the time

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
- Use professional, clear language in all messages and descriptions
- All existing tasks MUST be included in the response with their status
- **ONLY RETURN NEW CONTENT:** The actionItems and insights arrays should ONLY contain newly identified items that are NOT already in the existing lists. Do not include any existing action items or insights in your response.

# CRITICAL DUPLICATE PREVENTION RULES
- **BEFORE creating ANY action item:** Check if it already exists or is similar to existing ones
- **If in doubt, DO NOT create it** - better to miss an action item than create a duplicate
- **Action items should be RARE** - most conversations should generate 0-2 action items maximum
- **Only create action items with explicit commitment + specificity + scheduling/deadlines**
- **INSIGHTS ARE EXTREMELY RARE:** Most conversations should generate ZERO insights. Default to empty array unless there's MAJOR new information
- **Maximum 0-1 insights** per conversation (2 only in exceptional cases with critical information)

# DUPLICATE CHECK PROCEDURE FOR ACTION ITEMS:
1. Read the potential action item you want to create
2. Read through EVERY existing action item
3. Ask yourself: "Does any existing item cover this same goal, task, or commitment?"
4. If YES - DO NOT CREATE IT
5. If MAYBE - DO NOT CREATE IT (err on the side of not duplicating)
6. If NO and it meets all criteria (committed + specific + scheduled) - CREATE IT

# YOU WILL BE PENALIZED FOR CREATING DUPLICATE ACTION ITEMS OR INSIGHTS. ALWAYS DEFAULT TO EMPTY ARRAYS IF UNCERTAIN.
`;

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
