import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_api_key" || apiKey === "sk-proj-...") {
      return NextResponse.json(
        {
          error: {
            message:
              "OPENAI_API_KEY is not configured. Add it to .env.local and restart the dev server.",
            code: "missing_openai_api_key",
          },
        },
        { status: 500 },
      );
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime-2",
          },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error("client_secrets error:", data);
      return NextResponse.json(data, { status: response.status });
    }
    if (!data.value) {
      return NextResponse.json(
        {
          error: {
            message: "OpenAI did not return a realtime client secret.",
            code: "missing_client_secret",
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      client_secret: { value: data.value, expires_at: data.expires_at },
      session: data.session,
    });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
