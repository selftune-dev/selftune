import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Terminal } from '../components/Terminal';
import { TerminalLine } from '../components/TerminalLine';
import { PAI_THEME, TERMINAL_THEME } from '../theme';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

const { fontFamily: inter } = loadInter();
const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

const COMMAND_TEXT = 'make me a slide deck for the Q3 board meeting';

export const Act1Silence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dots appear at frame 400 and fade in/out
  const dotsOpacity = interpolate(
    frame,
    [400, 420, 480, 500],
    [0, 0.5, 0.5, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // After typing completes (~frame 80+), show blinking cursor on empty line
  const typingDone = frame > COMMAND_TEXT.length * 2 + 10;
  const cursorBlink = frame % 16 < 8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.backgroundDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: PAI_THEME.spacing.page,
      }}
    >
      <div style={{ width: '80%', maxWidth: 1200 }}>
        <Terminal title="Terminal">
          <TerminalLine
            text={COMMAND_TEXT}
            startFrame={0}
            isCommand
            typingSpeed={2}
          />
          {/* Empty line with blinking cursor after command completes */}
          {typingDone && (
            <div
              style={{
                fontFamily: jetBrainsMono,
                fontSize: TERMINAL_THEME.fontSize,
                lineHeight: `${TERMINAL_THEME.lineHeight}px`,
                color: TERMINAL_THEME.textBright,
                marginTop: 8,
                whiteSpace: 'pre',
              }}
            >
              {/* Subtle "..." to emphasize silence at frame 400 */}
              <span style={{ opacity: dotsOpacity, color: TERMINAL_THEME.text }}>
                ...
              </span>
              {/* Blinking cursor on the waiting line */}
              {dotsOpacity === 0 && (
                <span
                  style={{
                    color: TERMINAL_THEME.cursor,
                    opacity: cursorBlink ? 1 : 0,
                  }}
                >
                  {'\u258C'}
                </span>
              )}
            </div>
          )}
        </Terminal>
      </div>
    </AbsoluteFill>
  );
};
