import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Readable } from 'stream';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function PUT(request: NextRequest) {
  try {
    const data = await request.formData();
    const audioFile = data.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const audioStream = new Readable();
    audioStream.push(buffer);
    audioStream.push(null);

    (audioStream as any).path = audioFile.name;
    (audioStream as any).name = audioFile.name;

    // Stream transcription
    const stream = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text',
      stream: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming transcription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to stream transcription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
