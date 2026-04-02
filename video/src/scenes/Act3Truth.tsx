import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { GlowText } from '../components/GlowText';
import { Terminal } from '../components/Terminal';
import { StatusTable } from '../components/StatusTable';
import { PAI_THEME, TERMINAL_THEME } from '../theme';

const { fontFamily: inter } = loadInter();
const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

const MISSED_QUERIES = [
  { text: '"slides"', frame: 900 },
  { text: '"deck"', frame: 940 },
  { text: '"presentation for Monday"', frame: 980 },
];

export const Act3Truth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // GlowText fades in during first 300 frames, then fades out
  const glowFadeOut = interpolate(
    frame,
    [250, 300],
    [1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Terminal fades in at frame 300
  const terminalOpacity = interpolate(
    frame,
    [300, 330],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const terminalTranslateY = interpolate(
    frame,
    [300, 340],
    [20, 0],
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
      {/* GlowText header - first 300 frames */}
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
          opacity: glowFadeOut,
          pointerEvents: 'none',
        }}
      >
        <GlowText text="Here's what's actually happening." fontSize={56} delay={0} />
      </div>

      {/* Terminal with StatusTable - from frame 300 */}
      <div
        style={{
          width: '80%',
          maxWidth: 1200,
          opacity: terminalOpacity,
          transform: `translateY(${terminalTranslateY}px)`,
        }}
      >
        <Terminal title="selftune status">
          <StatusTable startFrame={330} />
        </Terminal>
      </div>

      {/* Missed queries - from frame 900 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginTop: 20,
        }}
      >
        {MISSED_QUERIES.map((query, i) => {
          const queryOpacity = interpolate(
            frame,
            [query.frame, query.frame + 15],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
          );

          const queryTranslateX = interpolate(
            frame,
            [query.frame, query.frame + 15],
            [-10, 0],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                fontFamily: jetBrainsMono,
                fontSize: 22,
                opacity: queryOpacity,
                transform: `translateX(${queryTranslateX}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ color: TERMINAL_THEME.red }}>{query.text}</span>
              <span style={{ color: TERMINAL_THEME.red, fontSize: 18 }}>
                {'✗ missed'}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
