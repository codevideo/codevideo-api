import { kokoroVoices, isKokoroVoice } from "./kokoroVoices.js";
it("allows only the curated English voices", () => {
  expect(kokoroVoices).toContain("af_heart");
  expect(new Set(kokoroVoices).size).toBe(kokoroVoices.length);
  for (const v of kokoroVoices) expect(isKokoroVoice(v)).toBe(true);
  for (const v of ["nope", "ff_siwis", null, 1, "AF_HEART"])
    expect(isKokoroVoice(v)).toBe(false);
});
