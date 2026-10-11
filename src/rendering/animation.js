// Animasyon eğrileri fiziği ve çarpışma konumlarını değiştirmez.
export const CUTSCENE_DURATION = 2.4;
export const REDUCED_CUTSCENE_DURATION = 0.65;
export const IMPACT_PHASE = 0.44;
export const clamp = (value) => Math.max(0, Math.min(1, value));
export const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
export const segment = (value, start, end) =>
  smooth((value - start) / (end - start));
