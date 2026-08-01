import { Dimensions } from 'react-native';

// Design is built against a 390dp-wide reference (iPhone 12-ish). We scale
// font sizes and fixed dimensions proportionally so layouts adapt to any
// phone width / aspect ratio (e.g. 19.5:9, 20:9, 18:9). The app is
// portrait-locked (app.json orientation), so width is stable per device.
const DESIGN_WIDTH = 390;
const { width: WINDOW_WIDTH } = Dimensions.get('window');

export function scale(size: number): number {
  return Math.round((WINDOW_WIDTH / DESIGN_WIDTH) * size);
}

// Clamped scale so huge text never overflows, and tiny text stays readable.
export function scaleClamped(size: number, min = 10, max = 56): number {
  return Math.max(min, Math.min(max, scale(size)));
}
