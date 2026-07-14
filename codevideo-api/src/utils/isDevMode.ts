/**
 * Local dev mode, gated strictly on ENVIRONMENT=development.
 *
 * When on, the API relaxes for local work: no auth / token checks, no S3 (audio
 * is embedded inline as a base64 data URI), and TTS defaults to the self-hosted
 * Kokoro service unless the request asks for elevenlabs.
 *
 * NEVER set ENVIRONMENT=development on a real deployment — staging and production
 * use their own ENVIRONMENT value, so this stays off there.
 */
export const isDevMode = (): boolean => process.env.ENVIRONMENT === "development";
