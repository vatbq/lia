import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Esquema para validar el input
const requestSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      completed: z.boolean().optional(),
    })
  ),
  transcription: z.string(),
});

// Esquema para la respuesta
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

    console.log(process.env.OPENAI_API_KEY);
    // Validar el input
    const { tasks, transcription } = requestSchema.parse(body);

    // Preparar el contexto para el AI
    const conversationText = transcription;

    const tasksText = tasks
      .map(
        (task: any) =>
          `- ${task.id}: ${task.title}${
            task.description ? ` - ${task.description}` : ''
          }${
            task.completed !== undefined
              ? ` (Currently: ${task.completed ? 'COMPLETED' : 'PENDING'})`
              : ''
          }`
      )
      .join('\n');

    const prompt = `Analiza la siguiente conversación y lista de tareas. Determina el estado de cada tarea basándote en la conversación.

CONVERSACIÓN:
${conversationText}

TAREAS:
${tasksText}

Para cada tarea, determina:
1. Si está completada (completed: true) o pendiente (completed: false) basándote en la conversación
2. Un mensaje explicativo (que solo sera si la tarea esta completada)
   - Si está completada: explica por qué se considera completada

Debes responder con un JSON con la estructura:
{
  "tasks": {
    "task-id": {
      "completed": boolean,
      "message": "string explicativo en caso de estar completada"
    }
  }
}

Donde cada key del objeto tasks es el ID de la tarea.`;

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: responseSchema,
      prompt: prompt,
    });

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
