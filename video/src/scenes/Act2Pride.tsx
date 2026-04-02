import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Terminal } from '../components/Terminal';
import { TerminalLine } from '../components/TerminalLine';
import { GlowText } from '../components/GlowText';
import { PAI_THEME, TERMINAL_THEME } from '../theme';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

const { fontFamily: inter } = loadInter();
const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

export const Act2Pride: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // GlowText "You shipped it." fades in at frame 750
  const glowOpacity = spring({
    frame: frame - 750,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

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
      <div style={{ width: '80%', maxWidth: 1200 }}>
        <Terminal title="SKILL.md">
          {/* Line 1: "# pptx" as command */}
          <TerminalLine
            text="# pptx"
            startFrame={0}
            isCommand
            typingSpeed={2}
          />
          {/* Line 2: description as output with typewriter */}
          <TerminalLine
            text="description: Generate PowerPoint presentations"
            startFrame={60}
            typingSpeed={2}
          />
          {/* Line 3: "# Testing..." as command */}
          <TerminalLine
            text="# Testing..."
            startFrame={180}
            isCommand
            typingSpeed={2}
          />
          {/* Line 4: test query as output */}
          <TerminalLine
            text={'"generate a PowerPoint presentation"'}
            startFrame={240}
            isOutput
          />
          {/* Line 5: success in green */}
          {frame >= 360 && (
            <div
              style={{
                fontFamily: jetBrainsMono,
                fontSize: TERMINAL_THEME.fontSize,
                lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                color: TERMINAL_THEME.green,
                opacity: interpolate(frame, [360, 370], [0, 1], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                }),
                whiteSpace: 'pre',
              }}
            >
              {'✓ Skill triggered successfully'}
            </div>
          )}
          {/* Line 6: second test query */}
          <TerminalLine
            text={'"make slides for the board meeting"'}
            startFrame={500}
            isOutput
          />
          {/* Line 7: second success in green */}
          {frame >= 620 && (
            <div
              style={{
                fontFamily: jetBrainsMono,
                fontSize: TERMINAL_THEME.fontSize,
                lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                color: TERMINAL_THEME.green,
                opacity: interpolate(frame, [620, 630], [0, 1], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                }),
                whiteSpace: 'pre',
              }}
            >
              {'✓ Skill triggered successfully'}
            </div>
          )}
        </Terminal>
      </div>

      {/* "You shipped it." glow text */}
      <div style={{ opacity: glowOpacity, textAlign: 'center' }}>
        <GlowText text="You shipped it." fontSize={56} delay={750} />
      </div>
    </AbsoluteFill>
  );
};
