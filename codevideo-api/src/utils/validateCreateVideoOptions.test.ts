import {
  validateCreateVideoOptions,
  buildCodeVideoIDEProps,
  buildVideoOptions,
} from "./validateCreateVideoOptions.js";

describe("validateCreateVideoOptions", () => {
  it("treats absent options as a valid no-op", () => {
    expect(validateCreateVideoOptions(undefined)).toEqual({ valid: true, options: {} });
    expect(validateCreateVideoOptions(null)).toEqual({ valid: true, options: {} });
    expect(validateCreateVideoOptions({})).toEqual({ valid: true, options: {} });
  });

  it("rejects a non-object options value", () => {
    expect(validateCreateVideoOptions([]).valid).toBe(false);
    expect(validateCreateVideoOptions("nope").valid).toBe(false);
  });

  it("ignores unknown keys rather than forwarding them", () => {
    const result = validateCreateVideoOptions({
      isStreaming: true,
      debug: true,
      showDevBox: true,
      somethingElse: 1,
      theme: "dark",
    });
    expect(result.valid).toBe(true);
    expect(result.options).toEqual({ theme: "dark" });
  });

  it("accepts the documented allowlist", () => {
    const input = {
      voiceId: "af_heart",
      ttsProvider: "elevenlabs",
      resolution: "4K",
      orientation: "portrait",
      theme: "light",
      withCaptions: false,
      fontSizePx: 32,
      fileExplorerWidth: 300,
      terminalHeight: 200,
      mouseColor: "red",
      isFileExplorerVisible: true,
      isTerminalVisible: false,
      keyboardTypingPauseMs: 20,
      standardPauseMs: 500,
      longPauseMs: 4000,
      defaultLanguage: "typescript",
    };
    const result = validateCreateVideoOptions(input);
    expect(result.valid).toBe(true);
    expect(result.options).toEqual(input);
  });

  it("enforces enums", () => {
    expect(validateCreateVideoOptions({ resolution: "720p" }).valid).toBe(false);
    expect(validateCreateVideoOptions({ orientation: "sideways" }).valid).toBe(false);
    expect(validateCreateVideoOptions({ theme: "midnight" }).valid).toBe(false);
    expect(validateCreateVideoOptions({ ttsProvider: "festival" }).valid).toBe(false);
  });

  it("type-checks strings, booleans, and positive numbers", () => {
    expect(validateCreateVideoOptions({ voiceId: "" }).valid).toBe(false);
    expect(validateCreateVideoOptions({ withCaptions: "yes" }).valid).toBe(false);
    expect(validateCreateVideoOptions({ fontSizePx: 0 }).valid).toBe(false);
    expect(validateCreateVideoOptions({ fontSizePx: -10 }).valid).toBe(false);
    expect(validateCreateVideoOptions({ standardPauseMs: "fast" }).valid).toBe(false);
  });
});

describe("buildCodeVideoIDEProps", () => {
  it("maps only the layout/IDE fields, excluding voice and recording dimensions", () => {
    const { options } = validateCreateVideoOptions({
      voiceId: "af_heart",
      resolution: "4K",
      orientation: "portrait",
      theme: "dark",
      fontSizePx: 28,
      withCaptions: true,
    });
    const props = buildCodeVideoIDEProps(options);
    expect(props).toEqual({ theme: "dark", fontSizePx: 28, withCaptions: true });
    expect(props).not.toHaveProperty("voiceId");
    expect(props).not.toHaveProperty("resolution");
    expect(props).not.toHaveProperty("orientation");
  });

  it("returns an empty object when no layout fields are set", () => {
    const { options } = validateCreateVideoOptions({ voiceId: "af_heart" });
    expect(buildCodeVideoIDEProps(options)).toEqual({});
  });
});

describe("buildVideoOptions", () => {
  it("extracts only resolution and orientation", () => {
    const { options } = validateCreateVideoOptions({
      resolution: "4K",
      orientation: "portrait",
      theme: "dark",
    });
    expect(buildVideoOptions(options)).toEqual({ resolution: "4K", orientation: "portrait" });
  });

  it("returns an empty object when neither is set", () => {
    const { options } = validateCreateVideoOptions({ theme: "dark" });
    expect(buildVideoOptions(options)).toEqual({});
  });
});
