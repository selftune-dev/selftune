import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { PAI_THEME } from './theme';
import { Act1Silence } from './scenes/Act1Silence';
import { Act2Pride } from './scenes/Act2Pride';
import { Act3Truth } from './scenes/Act3Truth';
import { Act4Loop } from './scenes/Act4Loop';
import { Act5Proof } from './scenes/Act5Proof';
import { Act6Install } from './scenes/Act6Install';

export const SelftuneVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: PAI_THEME.colors.backgroundDark }}>
      <Series>
        <Series.Sequence durationInFrames={750} premountFor={30}>
          <Act1Silence />
        </Series.Sequence>
        <Series.Sequence durationInFrames={900} premountFor={30}>
          <Act2Pride />
        </Series.Sequence>
        <Series.Sequence durationInFrames={1350} premountFor={30}>
          <Act3Truth />
        </Series.Sequence>
        <Series.Sequence durationInFrames={1950} premountFor={30}>
          <Act4Loop />
        </Series.Sequence>
        <Series.Sequence durationInFrames={750} premountFor={30}>
          <Act5Proof />
        </Series.Sequence>
        <Series.Sequence durationInFrames={600} premountFor={30}>
          <Act6Install />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
