import { IGenerateVideoFromActionsOptions } from "@fullstackcraftllc/codevideo-types";
import { Request, Response } from "express";
import os from "os";

export const validateBodyParams = (
    req: Request<{}, {}, IGenerateVideoFromActionsOptions>,
    res: Response
) => {
    const { actions, language, textToSpeechOption } = req.body;

    if (!actions) {
        return res.status(400).json({ error: "actions are required" });
    }

    if (!language) {
        return res.status(400).json({ error: "language is required" });
    }

    if (!textToSpeechOption) {
        return res.status(400).json({ error: "textToSpeechOption is required" });
    }

    // if actions are more than 100, return that they need to sign for a premium liscense at https://codevideo.io/codevideo-cloud/
    if (actions.length > 100) {
        return res.status(400).json({
            error:
                "You have more than 100 actions. Please sign up for a premium subscription at https://codevideo.io/codevideo-cloud/ or see how to setup your own CodeVideo engine backend at https://github.com/codevideo/codevideo-api",
        });
    }

    if (
        (textToSpeechOption === "openai" || textToSpeechOption === "elevenlabs") &&
        (!req.body.ttsApiKey || !req.body.ttsVoiceId)
    ) {
        return res.status(400).json({
            error:
                "If using 'openai' or 'elevenlabs' as the textToSpeechOption, you must provide both the 'ttsApiKey' and 'ttsVoiceId' parameters.",
        });
    }

    if (os.platform() === "linux" && textToSpeechOption === "sayjs") {
        return res.status(400).json({
            error: "sayjs is not supported for file export on linux",
        });
    }
};