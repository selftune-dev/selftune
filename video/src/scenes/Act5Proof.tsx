import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { GlowText } from '../components/GlowText';
import { BarChart } from '../components/BarChart';
import { PAI_THEME } from '../theme';

const { fontFamily: inter } = loadInter();

export const Act5Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // GlowText "The result?" fades out before chart appears
  const headerFadeOut = interpolate(
    frame,
    [80, 100],
    [1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Dashboard text spring at frame 600
  const dashSpring = spring({
    frame: frame - 600,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const dashOpacity = interpolate(
    frame,
    [600, 620],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.backgroundDark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: PAI_THEME.spacing.page,
        gap: 40,
      }}
    >
      {/* "The result?" header text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: headerFadeOut,
          pointerEvents: 'none',
        }}
      >
        <GlowText text="The result?" fontSize={64} delay={0} />
      </div>

      {/* BarChart centered */}
      <div style={{ marginTop: 20 }}>
        <BarChart startFrame={100} />
      </div>

      {/* Dashboard subtitle text */}
      <div
        style={{
          fontFamily: inter,
          fontSize: 24,
          color: PAI_THEME.colors.textMuted,
          opacity: dashOpacity,
          transform: `translateY(${interpolate(dashSpring, [0, 1], [10, 0], { extrapolateRight: 'clamp' })}px)`,
          textAlign: 'center',
        }}
      >
        One evolution cycle. Fully automatic.
      </div>
    </AbsoluteFill>
  );
};
