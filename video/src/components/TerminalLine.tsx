import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { TERMINAL_THEME } from '../theme';

const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

interface TerminalLineProps {
  text: string;
  startFrame: number;
  isCommand?: boolean;
  isOutput?: boolean;
  typingSpeed?: number;
}

export const TerminalLine: React.FC<TerminalLineProps> = ({
  text,
  startFrame,
  isCommand = false,
  isOutput = false,
  typingSpeed = 2,
}) => {
  const frame = useCurrentFrame();

  // Not yet visible
  if (frame < startFrame) {
    return null;
  }

  // Output mode: instant fade-in over 10 frames
  if (isOutput) {
    const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    return (
      <div
        style={{
          fontFamily: jetBrainsMono,
          fontSize: TERMINAL_THEME.fontSize,
          lineHeight: `${TERMINAL_THEME.lineHeight}px`,
          color: TERMINAL_THEME.text,
          opacity,
          whiteSpace: 'pre',
        }}
      >
        {text}
      </div>
    );
  }

  // Typewriter mode (command or plain text)
  const elapsed = frame - startFrame;
  const totalChars = text.length;
  const typedChars = Math.min(
    Math.floor(elapsed / typingSpeed),
    totalChars
  );
  const isTypingComplete = typedChars >= totalChars;

  // Blinking cursor: visible when typing, or blinks after completion
  const showCursor = !isTypingComplete || frame % 16 < 8;

  const displayedText = text.slice(0, typedChars);

  return (
    <div
      style={{
        fontFamily: jetBrainsMono,
        fontSize: TERMINAL_THEME.fontSize,
        lineHeight: `${TERMINAL_THEME.lineHeight}px`,
        color: TERMINAL_THEME.textBright,
        whiteSpace: 'pre',
      }}
    >
      {isCommand && (
        <span style={{ color: TERMINAL_THEME.prompt }}>$ </span>
      )}
      <span>{displayedText}</span>
      <span
        style={{
          color: TERMINAL_THEME.cursor,
          opacity: showCursor ? 1 : 0,
        }}
      >
        {'\u258C'}
      </span>
    </div>
  );
};
