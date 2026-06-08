import OpenAI from "openai";
import { requireEnv } from "@/lib/config/env";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requireEnv("OPENAI_API_KEY"),
    });
  }
  return client;
}
