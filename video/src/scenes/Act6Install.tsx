import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { Terminal } from '../components/Terminal';
import { TerminalLine } from '../components/TerminalLine';
import { Logo } from '../components/Logo';
import { GlowText } from '../components/GlowText';
import { PAI_THEME, TERMINAL_THEME } from '../theme';

const { fontFamily: inter } = loadInter();
const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

export const Act6Install: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Terminal fades out as logo section takes over
  const terminalOpacity = interpolate(
    frame,
    [0, 10, 220, 250],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Logo section fades in at frame 250
  const logoSectionOpacity = interpolate(
    frame,
    [250, 280],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // GitHub URL spring
  const urlSpring = spring({
    frame: frame - 380,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const urlOpacity = interpolate(
    frame,
    [380, 400],
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
      }}
    >
      {/* Terminal install section: frames 0-250 */}
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
          opacity: terminalOpacity,
          padding: PAI_THEME.spacing.page,
        }}
      >
        <div style={{ width: '80%', maxWidth: 1200 }}>
          <Terminal title="Install">
            <TerminalLine
              text="npx skills add WellDunDun/selftune"
              startFrame={30}
              isCommand
              typingSpeed={2}
            />
            {/* Success in green */}
            {frame >= 120 && (
              <div
                style={{
                  fontFamily: jetBrainsMono,
                  fontSize: TERMINAL_THEME.fontSize,
                  lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                  color: TERMINAL_THEME.green,
                  opacity: interpolate(frame, [120, 130], [0, 1], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  }),
                  whiteSpace: 'pre',
                }}
              >
                {'✓ selftune installed'}
              </div>
            )}
            <TerminalLine
              text="selftune status"
              startFrame={180}
              isCommand
              typingSpeed={2}
            />
          </Terminal>
        </div>
      </div>

      {/* Logo + tagline section: frames 250-600 */}
      <div
        style={{
          opacity: logoSectionOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
        }}
      >
        <Logo scale={1.5} delay={250} />

        <GlowText
          text="Your skills trigger half the time. selftune fixes that."
          fontSize={32}
          delay={300}
        />

        <div
          style={{
            fontFamily: inter,
            fontSize: 24,
            color: PAI_THEME.colors.textMuted,
            opacity: urlOpacity,
            transform: `translateY(${interpolate(urlSpring, [0, 1], [8, 0], { extrapolateRight: 'clamp' })}px)`,
            textAlign: 'center',
          }}
        >
          github.com/WellDunDun/selftune
        </div>
      </div>
    </AbsoluteFill>
  );
};
