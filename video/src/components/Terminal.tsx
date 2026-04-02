import React from 'react';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { TERMINAL_THEME } from '../theme';

const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

interface TerminalProps {
  children: React.ReactNode;
  title?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  children,
  title = 'Terminal',
}) => {
  return (
    <div
      style={{
        fontFamily: jetBrainsMono,
        borderRadius: TERMINAL_THEME.borderRadius,
        overflow: 'hidden',
        backgroundColor: TERMINAL_THEME.bg,
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        width: '100%',
      }}
    >
      {/* macOS-style header bar */}
      <div
        style={{
          height: TERMINAL_THEME.headerHeight,
          backgroundColor: TERMINAL_THEME.headerBg,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          position: 'relative',
        }}
      >
        {/* Traffic light dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: TERMINAL_THEME.dotClose,
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: TERMINAL_THEME.dotMinimize,
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: TERMINAL_THEME.dotMaximize,
            }}
          />
        </div>

        {/* Centered title */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: TERMINAL_THEME.text,
            fontSize: 13,
            fontFamily: jetBrainsMono,
            pointerEvents: 'none',
          }}
        >
          {title}
        </div>
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: TERMINAL_THEME.padding,
          minHeight: 100,
        }}
      >
        {children}
      </div>
    </div>
  );
};
