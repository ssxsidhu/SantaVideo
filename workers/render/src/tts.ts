import type { MasterConfig } from "@santa/core";

/** ElevenLabs list rate used for spend tracking (conservative Creator effective rate, config/vendor-rates.json). */
export const TTS_USD_PER_CHAR = 0.00018;

/**
 * Greeting TTS with the master's voice and settings. Only the greeting text is sent (a first name, no
 * order or customer identifiers). Returns MP3 bytes.
 */
export async function synthesizeGreeting(master: MasterConfig, text: string, speed: number): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set (needs Text to Speech access)");
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(master.voiceId)}?output_format=mp3_44100_192`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: master.tts.model,
        voice_settings: {
          stability: master.tts.stability,
          similarity_boost: master.tts.similarity_boost,
          style: master.tts.style,
          speed,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) {
    // Status only: the error body can echo the request text.
    throw new Error(`ElevenLabs TTS failed (HTTP ${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}
