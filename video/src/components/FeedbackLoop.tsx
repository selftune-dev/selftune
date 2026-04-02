import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { PAI_THEME } from '../theme';

const { fontFamily: inter } = loadInter();

interface FeedbackLoopProps {
  startFrame?: number;
}

const NODES = [
  { label: 'Observe', color: '#3b82f6', angle: -90 },   // Top (12 o'clock)
  { label: 'Detect', color: '#f59e0b', angle: 0 },       // Right (3 o'clock)
  { label: 'Evolve', color: '#8b5cf6', angle: 90 },      // Bottom (6 o'clock)
  { label: 'Watch', color: '#10b981', angle: 180 },       // Left (9 o'clock)
];

const RADIUS = 150;
const CENTER = 250;
const NODE_W = 120;
const NODE_H = 50;
const STAGGER = 20;
const ARROW_START = 80; // frames after startFrame
const ARROW_DRAW_DURATION = 20;
const ARROW_STAGGER = 15;
const GLOW_CYCLE = 60; // frames per node highlight

const getNodeCenter = (angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER + RADIUS * Math.sin(rad),
  };
};

// Generate quadratic bezier path curving outward between two nodes
const getArrowPath = (fromAngle: number, toAngle: number): string => {
  const from = getNodeCenter(fromAngle);
  const to = getNodeCenter(toAngle);
  // Control point: push outward from center
  const midAngle = ((fromAngle + toAngle) / 2) * (Math.PI / 180);
  // If angles wrap around (e.g. 180 to -90), adjust
  const angleDiff = toAngle - fromAngle;
  const adjustedMidAngle = angleDiff > 180 || angleDiff < -180
    ? ((fromAngle + toAngle + 360) / 2) * (Math.PI / 180)
    : midAngle;
  const controlDist = RADIUS * 1.35;
  const cx = CENTER + controlDist * Math.cos(adjustedMidAngle);
  const cy = CENTER + controlDist * Math.sin(adjustedMidAngle);
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
};

export const FeedbackLoop: React.FC<FeedbackLoopProps> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Which node is highlighted by the cycling glow
  const allArrowsDone = startFrame + ARROW_START + ARROW_DRAW_DURATION + ARROW_STAGGER * 3;
  const glowActive = frame > allArrowsDone;
  const glowIndex = glowActive
    ? Math.floor(((frame - allArrowsDone) % (GLOW_CYCLE * 4)) / GLOW_CYCLE)
    : -1;

  return (
    <div
      style={{
        width: CENTER * 2,
        height: CENTER * 2,
        position: 'relative',
        fontFamily: inter,
      }}
    >
      {/* SVG arrows */}
      <svg
        width={CENTER * 2}
        height={CENTER * 2}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.7)" />
          </marker>
        </defs>
        {NODES.map((node, i) => {
          const nextNode = NODES[(i + 1) % NODES.length];
          const arrowDelay = startFrame + ARROW_START + ARROW_STAGGER * i;
          const progress = interpolate(
            frame - arrowDelay,
            [0, ARROW_DRAW_DURATION],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
          );
          const pathD = getArrowPath(node.angle, nextNode.angle);
          // Approximate path length for dash animation
          const pathLength = 250;
          const dashOffset = pathLength * (1 - progress);

          return (
            <path
              key={`arrow-${i}`}
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={2}
              strokeDasharray={pathLength}
              strokeDashoffset={dashOffset}
              markerEnd={progress > 0.9 ? 'url(#arrowhead)' : undefined}
            />
          );
        })}
      </svg>

      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          left: CENTER - 50,
          top: CENTER - 14,
          width: 100,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 'bold',
          color: PAI_THEME.colors.accent,
          opacity: interpolate(
            frame - (startFrame + STAGGER * NODES.length),
            [0, 20],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
          ),
          textShadow: PAI_THEME.effects.glow,
        }}
      >
        selftune
      </div>

      {/* Nodes */}
      {NODES.map((node, i) => {
        const nodeDelay = startFrame + STAGGER * i;
        const scaleSpring = spring({
          frame: frame - nodeDelay,
          fps,
          config: { damping: 12, stiffness: 100 },
        });
        const pos = getNodeCenter(node.angle);
        const isGlowing = glowIndex === i;
        const glowOpacity = isGlowing
          ? interpolate(
              (frame - allArrowsDone) % GLOW_CYCLE,
              [0, GLOW_CYCLE / 2, GLOW_CYCLE],
              [0.4, 1, 0.4],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
            )
          : 0;

        return (
          <div
            key={`node-${i}`}
            style={{
              position: 'absolute',
              left: pos.x - NODE_W / 2,
              top: pos.y - NODE_H / 2,
              width: NODE_W,
              height: NODE_H,
              borderRadius: 12,
              backgroundColor: node.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${scaleSpring})`,
              boxShadow: isGlowing
                ? `0 0 ${20 + glowOpacity * 20}px ${node.color}`
                : 'none',
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
