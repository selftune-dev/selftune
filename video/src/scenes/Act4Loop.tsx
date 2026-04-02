import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { GlowText } from '../components/GlowText';
import { FeedbackLoop } from '../components/FeedbackLoop';
import { Terminal } from '../components/Terminal';
import { TerminalLine } from '../components/TerminalLine';
import { PAI_THEME, TERMINAL_THEME } from '../theme';

const { fontFamily: inter } = loadInter();
const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

export const Act4Loop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // GlowText "This is selftune." fades in frames 0-150
  const introFadeOut = interpolate(
    frame,
    [120, 150],
    [1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // FeedbackLoop diagram section: frames 150-900
  const diagramOpacity = interpolate(
    frame,
    [150, 180, 850, 900],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const diagramScale = interpolate(
    frame,
    [150, 200],
    [0.9, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Terminal section: frames 900-1950
  const terminalOpacity = interpolate(
    frame,
    [900, 930],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const terminalTranslateY = interpolate(
    frame,
    [900, 940],
    [30, 0],
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
      {/* "This is selftune." intro text */}
      <Sequence from={0} durationInFrames={150} premountFor={30}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: introFadeOut,
          }}
        >
          <GlowText text="This is selftune." fontSize={64} delay={0} />
        </AbsoluteFill>
      </Sequence>

      {/* FeedbackLoop diagram: frames 150-900 */}
      <Sequence from={150} durationInFrames={750} premountFor={30}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: diagramOpacity,
            transform: `scale(${diagramScale})`,
          }}
        >
          <FeedbackLoop startFrame={0} />
        </AbsoluteFill>
      </Sequence>

      {/* Terminal command demos: frames 900-1950 */}
      <Sequence from={900} durationInFrames={1050} premountFor={30}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: PAI_THEME.spacing.page,
          }}
        >
          <div
            style={{
              width: '85%',
              maxWidth: 1300,
              opacity: terminalOpacity,
              transform: `translateY(${terminalTranslateY}px)`,
            }}
          >
            <Terminal title="selftune">
              {/* observe command */}
              <TerminalLine
                text="selftune observe"
                startFrame={30}
                isCommand
                typingSpeed={2}
              />
              <TerminalLine
                text="Hooks installed. Capturing sessions..."
                startFrame={90}
                isOutput
              />

              {/* evals command */}
              <TerminalLine
                text="selftune evals --skill pptx"
                startFrame={200}
                isCommand
                typingSpeed={2}
              />
              {frame >= 1160 && (
                <div
                  style={{
                    fontFamily: jetBrainsMono,
                    fontSize: TERMINAL_THEME.fontSize,
                    lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                    color: TERMINAL_THEME.yellow,
                    opacity: interpolate(frame, [1160, 1170], [0, 1], {
                      extrapolateRight: 'clamp',
                      extrapolateLeft: 'clamp',
                    }),
                    whiteSpace: 'pre',
                  }}
                >
                  {'3 false negatives detected: "slides", "deck", "board presentation"'}
                </div>
              )}

              {/* evolve command */}
              <TerminalLine
                text="selftune evolve --skill pptx"
                startFrame={450}
                isCommand
                typingSpeed={2}
              />
              <TerminalLine
                text="Proposed description: Generate slide decks and presentations"
                startFrame={510}
                isOutput
              />
              {/* validation success in green */}
              {frame >= 1500 && (
                <div
                  style={{
                    fontFamily: jetBrainsMono,
                    fontSize: TERMINAL_THEME.fontSize,
                    lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                    color: TERMINAL_THEME.green,
                    opacity: interpolate(frame, [1500, 1510], [0, 1], {
                      extrapolateRight: 'clamp',
                      extrapolateLeft: 'clamp',
                    }),
                    whiteSpace: 'pre',
                  }}
                >
                  {'✓ Validation: 8/8 queries pass'}
                </div>
              )}

              {/* watch command */}
              <TerminalLine
                text="selftune watch --skill pptx"
                startFrame={750}
                isCommand
                typingSpeed={2}
              />
              <TerminalLine
                text="Monitoring active. Auto-rollback enabled."
                startFrame={810}
                isOutput
              />
            </Terminal>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
