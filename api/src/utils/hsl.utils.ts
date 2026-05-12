export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGBColor {
  r: number; // 0-255
  g: number;
  b: number;
}

// Convert HSL to RGB
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  h = Math.max(0, Math.min(360, h));
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// Convert RGB to HSL
export function rgbToHsl(r: number, g: number, b: number): HSLColor {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// HSL Distance Formula (accuracy calculation)
// Returns 0-100% where 100% = perfect match
export function calculateAccuracy(original: HSLColor, user: HSLColor): number {
  // Normalize HSL differences
  const hueDiff = Math.min(
    Math.abs(original.h - user.h),
    360 - Math.abs(original.h - user.h)
  ) / 180; // 0-2 range, normalize to 0-1
  
  const satDiff = Math.abs(original.s - user.s) / 100; // 0-1
  const lightDiff = Math.abs(original.l - user.l) / 100; // 0-1
  
  // Weighted: Hue is most important (50%), Saturation 25%, Lightness 25%
  const weightedDiff = (hueDiff * 0.5) + (satDiff * 0.25) + (lightDiff * 0.25);
  
  const accuracy = Math.max(0, Math.min(100, (1 - weightedDiff) * 100));
  
  return Math.round(accuracy * 1000) / 1000; // Round to 3 decimals
}

// Generate random HSL within given ranges
export function generateRandomColor(
  saturationRange: [number, number],
  lightnessRange: [number, number]
): HSLColor {
  return {
    h: Math.floor(Math.random() * 360),
    s: Math.floor(Math.random() * (saturationRange[1] - saturationRange[0] + 1) + saturationRange[0]),
    l: Math.floor(Math.random() * (lightnessRange[1] - lightnessRange[0] + 1) + lightnessRange[0]),
  };
}

// Validate HSL values
export function validateHSL(color: HSLColor): boolean {
  return (
    color.h >= 0 && color.h <= 360 &&
    color.s >= 0 && color.s <= 100 &&
    color.l >= 0 && color.l <= 100
  );
}