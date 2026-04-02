import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const { fontFamily: inter } = loadInter();

interface BarChartProps {
  startFrame?: number;
}

const BAR_MAX_HEIGHT = 300;
const BAR_WIDTH = 120;
const BAR_GAP = 60;

const BEFORE_PERCENT = 47;
const AFTER_PERCENT = 89;
const DELTA = '+42pp';

const BEFORE_COLOR = '#ef4444';
const AFTER_COLOR = '#10b981';
const ACCENT_COLOR = '#8b5cf6';

const PERCENTAGE_DURATION = 45;
const AFTER_DELAY = 30;
const DELTA_DELAY = 90;

export const BarChart: React.FC<BarChartProps> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Before bar spring animation
  const beforeSpring = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 200 },
  });
  const beforeHeight = beforeSpring * (BAR_MAX_HEIGHT * BEFORE_PERCENT / 100);

  // After bar spring animation (staggered)
  const afterSpring = spring({
    frame: frame - (startFrame + AFTER_DELAY),
    fps,
    config: { damping: 200 },
  });
  const afterHeight = afterSpring * (BAR_MAX_HEIGHT * AFTER_PERCENT / 100);

  // Before percentage count-up
  const beforePct = Math.round(
    interpolate(
      frame - startFrame,
      [0, PERCENTAGE_DURATION],
      [0, BEFORE_PERCENT],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
    ),
  );

  // After percentage count-up
  const afterPct = Math.round(
    interpolate(
      frame - (startFrame + AFTER_DELAY),
      [0, PERCENTAGE_DURATION],
      [0, AFTER_PERCENT],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
    ),
  );

  // Delta label spring
  const deltaSpring = spring({
    frame: frame - (startFrame + DELTA_DELAY),
    fps,
    config: { damping: 15, stiffness: 120 },
  });
  const deltaOpacity = interpolate(
    frame - (startFrame + DELTA_DELAY),
    [0, 15],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const totalWidth = BAR_WIDTH * 2 + BAR_GAP;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: inter,
      }}
    >
      {/* Delta label */}
      <div
        style={{
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: totalWidth,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: ACCENT_COLOR,
            opacity: deltaOpacity,
            transform: `scale(${interpolate(deltaSpring, [0, 1], [0.5, 1], { extrapolateRight: 'clamp' })})`,
          }}
        >
          {DELTA}
        </span>
      </div>

      {/* Bars area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: BAR_GAP,
          height: BAR_MAX_HEIGHT,
        }}
      >
        {/* Before bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Percentage label */}
          <div
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#f1f5f9',
              marginBottom: 8,
              fontFamily: inter,
            }}
          >
            {beforePct}%
          </div>
          {/* Bar */}
          <div
            style={{
              width: BAR_WIDTH,
              height: beforeHeight,
              backgroundColor: BEFORE_COLOR,
              borderRadius: '8px 8px 0 0',
            }}
          />
        </div>

        {/* After bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Percentage label */}
          <div
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#f1f5f9',
              marginBottom: 8,
              fontFamily: inter,
            }}
          >
            {afterPct}%
          </div>
          {/* Bar */}
          <div
            style={{
              width: BAR_WIDTH,
              height: afterHeight,
              backgroundColor: AFTER_COLOR,
              borderRadius: '8px 8px 0 0',
            }}
          />
        </div>
      </div>

      {/* Labels below bars */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: BAR_GAP,
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: BAR_WIDTH,
            textAlign: 'center',
            fontSize: 18,
            color: '#f1f5f9',
            fontFamily: inter,
          }}
        >
          Before
        </div>
        <div
          style={{
            width: BAR_WIDTH,
            textAlign: 'center',
            fontSize: 18,
            color: '#f1f5f9',
            fontFamily: inter,
          }}
        >
          After
        </div>
      </div>
    </div>
  );
};
