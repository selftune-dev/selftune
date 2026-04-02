import React from 'react';
import { useCurrentFrame, spring, useVideoConfig, staticFile } from 'remotion';

interface LogoProps {
  scale?: number;
  delay?: number;
}

export const Logo: React.FC<LogoProps> = ({
  scale = 1,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring scale-in from 0 to target scale
  const springValue = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  const currentScale = springValue * scale;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <img
        src={staticFile('selftune-logo.svg')}
        alt="selftune"
        style={{
          width: 200 * scale,
          transform: `scale(${currentScale / scale})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};
