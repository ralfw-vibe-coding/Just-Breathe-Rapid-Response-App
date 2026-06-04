import { generateProtocolSuggestions } from "../../server/ai-protocol-assistant.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const result = await generateProtocolSuggestions(payload);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown AI assistant error"
      })
    };
  }
}
