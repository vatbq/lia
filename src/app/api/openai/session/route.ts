import { NextResponse } from "next/server";

export async function GET() {
  console.log("[API] GET /api/openai/session - Request received");
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[API] OPENAI_API_KEY is not configured");
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 },
    );
  }

  console.log("[API] OPENAI_API_KEY found, making request to OpenAI");
  try {
    const requestBody = {
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      session: {
        type: "transcription",
      },
    };
    console.log("[API] Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    console.log("[API] OpenAI response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error(
        "[API] OpenAI error response:",
        JSON.stringify(error, null, 2),
      );
      return NextResponse.json(
        { error: "Failed to create client secret", details: error },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log("[API] Successfully created client secret");
    console.log("[API] Response data:", JSON.stringify(data, null, 2));
    return NextResponse.json({ token: data.value });
  } catch (error) {
    console.error("[API] Exception creating client secret:", error);
    return NextResponse.json(
      { error: "Failed to create client secret", details: error },
      { status: 500 },
    );
  }
}
