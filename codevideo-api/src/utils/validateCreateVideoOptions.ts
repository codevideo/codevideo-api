import { ICodeVideoIDEProps } from "@fullstackcraftllc/codevideo-types";

export type VideoResolution = "1080p" | "4K";
export type VideoOrientation = "landscape" | "portrait";
export type TtsProvider = "kokoro" | "elevenlabs";

/**
 * Curated, API-safe options for /create-video-v3.
 *
 * A deliberately small allowlist over the much larger ICodeVideoIDEProps surface:
 * internal/debug/streaming props (isStreaming, debug, showDevBox) and React
 * callbacks are intentionally excluded so API callers can't drive the renderer
 * into odd states.
 */
export interface ICreateVideoOptions {
  // text-to-speech: overrides the active provider's default voice
  voiceId?: string;
  // text-to-speech provider override. Defaults to kokoro in dev mode, else the
  // CODEVIDEO_TTS_PROVIDER env (elevenlabs in production).
  ttsProvider?: TtsProvider;

  // recording dimensions. Carried in manifest.videoOptions for the CLI worker;
  // inert until the worker reads them (see plan Tier 2).
  resolution?: VideoResolution;
  orientation?: VideoOrientation;

  // IDE / layout — flow to manifest.codeVideoIDEProps, which the v3 render page
  // merges over its defaults.
  theme?: "light" | "dark";
  withCaptions?: boolean;
  fontSizePx?: number;
  fileExplorerWidth?: number;
  terminalHeight?: number;
  mouseColor?: string;
  isFileExplorerVisible?: boolean;
  isTerminalVisible?: boolean;
  keyboardTypingPauseMs?: number;
  standardPauseMs?: number;
  longPauseMs?: number;
  defaultLanguage?: string;
}

export interface IVideoOptions {
  resolution?: VideoResolution;
  orientation?: VideoOrientation;
}

export interface ValidateOptionsResult {
  valid: boolean;
  error?: string;
  /** Sanitized: only recognized, well-typed fields. Empty when input is absent. */
  options: ICreateVideoOptions;
}

const RESOLUTIONS: VideoResolution[] = ["1080p", "4K"];
const ORIENTATIONS: VideoOrientation[] = ["landscape", "portrait"];
const TTS_PROVIDERS: TtsProvider[] = ["kokoro", "elevenlabs"];

const STRING_FIELDS = ["voiceId", "mouseColor", "defaultLanguage"] as const;
const BOOLEAN_FIELDS = ["withCaptions", "isFileExplorerVisible", "isTerminalVisible"] as const;
const POSITIVE_NUMBER_FIELDS = [
  "fontSizePx",
  "fileExplorerWidth",
  "terminalHeight",
  "keyboardTypingPauseMs",
  "standardPauseMs",
  "longPauseMs",
] as const;

/**
 * Validate the optional `options` object on a /create-video-v3 request. Unknown
 * keys are ignored (not forwarded); recognized keys with the wrong type/enum
 * fail with a 400-friendly message. An absent/empty object is a valid no-op.
 */
export const validateCreateVideoOptions = (raw: unknown): ValidateOptionsResult => {
  const options: ICreateVideoOptions = {};

  if (raw === undefined || raw === null) {
    return { valid: true, options };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "options must be an object.", options };
  }

  const o = raw as Record<string, unknown>;

  if (o.resolution !== undefined) {
    if (!RESOLUTIONS.includes(o.resolution as VideoResolution)) {
      return { valid: false, error: `options.resolution must be one of: ${RESOLUTIONS.join(", ")}.`, options };
    }
    options.resolution = o.resolution as VideoResolution;
  }

  if (o.orientation !== undefined) {
    if (!ORIENTATIONS.includes(o.orientation as VideoOrientation)) {
      return { valid: false, error: `options.orientation must be one of: ${ORIENTATIONS.join(", ")}.`, options };
    }
    options.orientation = o.orientation as VideoOrientation;
  }

  if (o.theme !== undefined) {
    if (o.theme !== "light" && o.theme !== "dark") {
      return { valid: false, error: "options.theme must be 'light' or 'dark'.", options };
    }
    options.theme = o.theme;
  }

  if (o.ttsProvider !== undefined) {
    if (!TTS_PROVIDERS.includes(o.ttsProvider as TtsProvider)) {
      return { valid: false, error: `options.ttsProvider must be one of: ${TTS_PROVIDERS.join(", ")}.`, options };
    }
    options.ttsProvider = o.ttsProvider as TtsProvider;
  }

  for (const key of STRING_FIELDS) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== "string" || v.trim() === "") {
      return { valid: false, error: `options.${key} must be a non-empty string.`, options };
    }
    (options as Record<string, unknown>)[key] = v;
  }

  for (const key of BOOLEAN_FIELDS) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== "boolean") {
      return { valid: false, error: `options.${key} must be a boolean.`, options };
    }
    (options as Record<string, unknown>)[key] = v;
  }

  for (const key of POSITIVE_NUMBER_FIELDS) {
    const v = o[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      return { valid: false, error: `options.${key} must be a positive number.`, options };
    }
    (options as Record<string, unknown>)[key] = v;
  }

  return { valid: true, options };
};

/**
 * The subset of options that flows to the render component via
 * manifest.codeVideoIDEProps. Excludes voiceId (handled in TTS) and
 * resolution/orientation (carried separately — putting resolution here would
 * double the component font for 4K while the viewport stays 1080p).
 */
export const buildCodeVideoIDEProps = (options: ICreateVideoOptions): Partial<ICodeVideoIDEProps> => {
  const props: Partial<ICodeVideoIDEProps> = {};
  if (options.theme !== undefined) props.theme = options.theme;
  if (options.withCaptions !== undefined) props.withCaptions = options.withCaptions;
  if (options.fontSizePx !== undefined) props.fontSizePx = options.fontSizePx;
  if (options.fileExplorerWidth !== undefined) props.fileExplorerWidth = options.fileExplorerWidth;
  if (options.terminalHeight !== undefined) props.terminalHeight = options.terminalHeight;
  if (options.mouseColor !== undefined) props.mouseColor = options.mouseColor;
  if (options.isFileExplorerVisible !== undefined) props.isFileExplorerVisible = options.isFileExplorerVisible;
  if (options.isTerminalVisible !== undefined) props.isTerminalVisible = options.isTerminalVisible;
  if (options.keyboardTypingPauseMs !== undefined) props.keyboardTypingPauseMs = options.keyboardTypingPauseMs;
  if (options.standardPauseMs !== undefined) props.standardPauseMs = options.standardPauseMs;
  if (options.longPauseMs !== undefined) props.longPauseMs = options.longPauseMs;
  if (options.defaultLanguage !== undefined) {
    props.defaultLanguage = options.defaultLanguage as ICodeVideoIDEProps["defaultLanguage"];
  }
  return props;
};

/** Recording dimensions carried for the CLI worker (Tier 2). */
export const buildVideoOptions = (options: ICreateVideoOptions): IVideoOptions => {
  const videoOptions: IVideoOptions = {};
  if (options.resolution !== undefined) videoOptions.resolution = options.resolution;
  if (options.orientation !== undefined) videoOptions.orientation = options.orientation;
  return videoOptions;
};
