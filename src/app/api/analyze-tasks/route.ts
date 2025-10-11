import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { io } from 'socket.io-client';
import { getOpenAIClient } from '@/lib/openai';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

// Schema to validate input
const requestSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.number().optional(),
    })
  ),
  transcription: z.string(),
});

// Schema for the response
const responseSchema = z.object({
  tasks: z.record(
    z.string(),
    z.object({
      completed: z.boolean(),
      message: z.string().optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar el input
    const { tasks, transcription } = requestSchema.parse(body);

    // Prepare the context for the AI
    const conversationText = transcription;

    const tasksText = tasks
    .filter((task: any) => task.completed === false)
      .map(
        (task: any) =>
          `- PENDING ${task.id}: ${task.title}${
            task.description ? ` - ${task.description}` : ''
          }${
            task.completed !== undefined
              ? ` (Currently: 'PENDING')`
              : ''
          }`
      )
      .join('\n');

    const prompt = `Analyze the following conversation and task list. Determine the status of each task based on the conversation.

CONVERSATION:
${conversationText}

TASKS:
${tasksText}

For each task, determine:
1. If it's completed (completed: true) or pending (completed: false) 
2. An explanatory message of why it's completed (only if the task is completed)

You must respond with a JSON with the following structure:
{
  "tasks": {
    "task-id": {
      "completed": boolean,
      "message": "explanatory string if completed"
    }
  }
}
`;

    const { object } = await generateObject({
      model: openai('gpt-4.1-nano'),
      schema: responseSchema,
      prompt: prompt,
    });

    // Note: Socket emission will be handled by the client after receiving this response
    console.log('📤 Task analysis completed, client will handle socket emission');

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('Error analyzing tasks:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
