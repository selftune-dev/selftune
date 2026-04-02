import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { TERMINAL_THEME } from '../theme';

const { fontFamily: jetBrainsMono } = loadJetBrainsMono();

interface StatusTableProps {
  startFrame?: number;
}

interface RowData {
  skill: string;
  triggers: string;
  passRate: string;
  status: string;
  statusColor: string;
  rateColor: string;
}

const ROWS: RowData[] = [
  {
    skill: 'pptx',
    triggers: '34/72',
    passRate: '47%',
    status: 'REGRESSED',
    statusColor: TERMINAL_THEME.red,
    rateColor: TERMINAL_THEME.red,
  },
  {
    skill: 'markdown',
    triggers: '89/95',
    passRate: '94%',
    status: 'HEALTHY',
    statusColor: TERMINAL_THEME.green,
    rateColor: TERMINAL_THEME.green,
  },
  {
    skill: 'search',
    triggers: '67/80',
    passRate: '84%',
    status: 'HEALTHY',
    statusColor: TERMINAL_THEME.green,
    rateColor: TERMINAL_THEME.green,
  },
  {
    skill: 'calendar',
    triggers: '12/45',
    passRate: '27%',
    status: 'FAILING',
    statusColor: TERMINAL_THEME.red,
    rateColor: TERMINAL_THEME.red,
  },
];

const COL_WIDTHS = {
  skill: 15,
  triggers: 11,
  passRate: 12,
  status: 12,
};

const pad = (str: string, width: number): string => {
  return str + ' '.repeat(Math.max(0, width - str.length));
};

const SEPARATOR_LINE = '\u2500'.repeat(COL_WIDTHS.skill - 2)
  + '  '
  + '\u2500'.repeat(COL_WIDTHS.triggers - 2)
  + '  '
  + '\u2500'.repeat(COL_WIDTHS.passRate - 2)
  + '  '
  + '\u2500'.repeat(COL_WIDTHS.status);

const ROW_STAGGER = 15;

export const StatusTable: React.FC<StatusTableProps> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerDelay = startFrame;
  const separatorDelay = startFrame + ROW_STAGGER;

  const renderAnimatedRow = (rowIndex: number, content: React.ReactNode) => {
    const rowDelay = startFrame + ROW_STAGGER * (rowIndex + 2);
    const scale = spring({
      frame: frame - rowDelay,
      fps,
      config: { damping: 15, stiffness: 120 },
    });
    const opacity = interpolate(
      frame - rowDelay,
      [0, 10],
      [0, 1],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
    );

    return (
      <div
        key={rowIndex}
        style={{
          transform: `scale(${interpolate(scale, [0, 1], [0.95, 1], { extrapolateRight: 'clamp' })})`,
          opacity,
          transformOrigin: 'left center',
          lineHeight: `${TERMINAL_THEME.lineHeight}px`,
        }}
      >
        {content}
      </div>
    );
  };

  const headerScale = spring({
    frame: frame - headerDelay,
    fps,
    config: { damping: 15, stiffness: 120 },
  });
  const headerOpacity = interpolate(
    frame - headerDelay,
    [0, 10],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const sepScale = spring({
    frame: frame - separatorDelay,
    fps,
    config: { damping: 15, stiffness: 120 },
  });
  const sepOpacity = interpolate(
    frame - separatorDelay,
    [0, 10],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  return (
    <div
      style={{
        fontFamily: jetBrainsMono,
        fontSize: 18,
        color: TERMINAL_THEME.textBright,
        whiteSpace: 'pre',
        background: 'transparent',
      }}
    >
      {/* Header row */}
      <div
        style={{
          transform: `scale(${interpolate(headerScale, [0, 1], [0.95, 1], { extrapolateRight: 'clamp' })})`,
          opacity: headerOpacity,
          transformOrigin: 'left center',
          lineHeight: `${TERMINAL_THEME.lineHeight}px`,
          color: TERMINAL_THEME.text,
        }}
      >
        {pad('Skill', COL_WIDTHS.skill)}
        {pad('Triggers', COL_WIDTHS.triggers)}
        {pad('Pass Rate', COL_WIDTHS.passRate)}
        {'Status'}
      </div>

      {/* Separator row */}
      <div
        style={{
          transform: `scale(${interpolate(sepScale, [0, 1], [0.95, 1], { extrapolateRight: 'clamp' })})`,
          opacity: sepOpacity,
          transformOrigin: 'left center',
          lineHeight: `${TERMINAL_THEME.lineHeight}px`,
          color: TERMINAL_THEME.text,
        }}
      >
        {SEPARATOR_LINE}
      </div>

      {/* Data rows */}
      {ROWS.map((row, i) =>
        renderAnimatedRow(
          i,
          <span>
            <span style={{ color: TERMINAL_THEME.textBright }}>
              {pad(row.skill, COL_WIDTHS.skill)}
            </span>
            <span style={{ color: TERMINAL_THEME.textBright }}>
              {pad(row.triggers, COL_WIDTHS.triggers)}
            </span>
            <span style={{ color: row.rateColor }}>
              {pad(row.passRate, COL_WIDTHS.passRate)}
            </span>
            <span style={{ color: row.statusColor }}>
              {row.status}
            </span>
          </span>,
        ),
      )}
    </div>
  );
};
