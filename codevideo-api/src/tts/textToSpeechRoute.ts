import type { RequestHandler, ErrorRequestHandler } from "express";
import {
  validateTextToSpeechRequest,
  TextToSpeechError,
} from "./validateTextToSpeechRequest.js";
import { synthesizeTextToSpeech } from "./synthesizeTextToSpeech.js";
import { storeTextToSpeechAudio } from "./textToSpeechAssets.js";
import { textToSpeechRateLimit } from "./textToSpeechRateLimit.js";
export function createTextToSpeechHandler(
  dependencies = {
    synthesize: synthesizeTextToSpeech,
    store: storeTextToSpeechAudio,
    limiter: textToSpeechRateLimit,
  },
): RequestHandler {
  return async (req, res) => {
    try {
      const request = validateTextToSpeechRequest(req.body);
      const userId = (req as typeof req & { codevideoUserId?: string })
        .codevideoUserId;
      if (!userId) {
        res.status(401).json({ error: "Authentication required." });
        return;
      }
      const rate = dependencies.limiter.consume(userId);
      if (!rate.allowed) {
        res.setHeader("Retry-After", rate.retryAfterSeconds);
        res
          .status(429)
          .json({
            error:
              "Speech generation limit reached (30 per minute, 300 per day).",
          });
        return;
      }
      const audio = await dependencies.synthesize(request);
      const asset = await dependencies.store(
        audio,
        `${req.protocol}://${req.get("host")}`,
      );
      res.json({
        ...asset,
        provider: request.provider,
        voiceId: request.voiceId,
        speed: request.speed,
      });
    } catch (error) {
      // Do not log request bodies or provider exceptions: the request can carry a BYO key.
      if (error instanceof TextToSpeechError)
        res.status(error.status).json({ error: error.message });
      else
        res
          .status(500)
          .json({
            error: "Could not save the generated speech. Please try again.",
          });
    }
  };
}

export const textToSpeechJsonErrorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
) => {
  if (
    req.path === "/texttospeech" &&
    (error?.type === "entity.parse.failed" ||
      error?.type === "entity.too.large")
  ) {
    res
      .status(error.type === "entity.too.large" ? 413 : 400)
      .json({ error: "Invalid speech request JSON or request too large." });
    return;
  }
  next(error);
};
