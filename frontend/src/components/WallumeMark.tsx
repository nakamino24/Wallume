import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function WallumeMark({ size = 32, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" accessibilityLabel="Wallume">
      <Path d="M8 11.5L15.5 34.5L24 19L32.5 34.5L40 11.5" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
