import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { PAI_THEME } from '../theme';

const { fontFamily: inter } = loadInter();

interface GlowTextProps {
  text: string;
  fontSize?: number;
  delay?: number;
}

export const GlowText: React.FC<GlowTextProps> = ({
  text,
  fontSize = 48,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring fade-in starting at delay
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  });

  // Subtle pulsing glow using sine wave
  // Oscillates between 0.6 and 1.0 for a gentle pulse
  const glowIntensity = interpolate(
    Math.sin((frame - delay) * 0.08),
    [-1, 1],
    [0.6, 1.0],
    {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    }
  );

  // Build layered text-shadow for glow effect
  const baseGlow = PAI_THEME.effects.glow; // '0 0 20px rgba(139, 92, 246, 0.5)'
  const textShadow = [
    baseGlow,
    `0 0 40px rgba(139, 92, 246, ${0.3 * glowIntensity})`,
    `0 0 80px rgba(139, 92, 246, ${0.15 * glowIntensity})`,
    `0 0 120px rgba(139, 92, 246, ${0.08 * glowIntensity})`,
  ].join(', ');

  return (
    <div
      style={{
        fontFamily: inter,
        fontSize,
        fontWeight: 'bold',
        color: PAI_THEME.colors.text,
        textShadow,
        opacity,
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
};
