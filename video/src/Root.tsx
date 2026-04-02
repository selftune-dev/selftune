import React from 'react';
import { Composition, Folder } from 'remotion';
import { SelftuneVideo } from './SelftuneVideo';
import { SelftuneVideoSchema } from './schemas';
import { Act1Silence } from './scenes/Act1Silence';
import { Act2Pride } from './scenes/Act2Pride';
import { Act3Truth } from './scenes/Act3Truth';
import { Act4Loop } from './scenes/Act4Loop';
import { Act5Proof } from './scenes/Act5Proof';
import { Act6Install } from './scenes/Act6Install';

const SHARED = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SelftuneVideo"
        component={SelftuneVideo}
        schema={SelftuneVideoSchema}
        defaultProps={{ accentColor: '#8b5cf6' }}
        durationInFrames={6300}
        {...SHARED}
      />
      <Folder name="Scenes">
        <Composition
          id="Act1-Silence"
          component={Act1Silence}
          durationInFrames={750}
          {...SHARED}
        />
        <Composition
          id="Act2-Pride"
          component={Act2Pride}
          durationInFrames={900}
          {...SHARED}
        />
        <Composition
          id="Act3-Truth"
          component={Act3Truth}
          durationInFrames={1350}
          {...SHARED}
        />
        <Composition
          id="Act4-Loop"
          component={Act4Loop}
          durationInFrames={1950}
          {...SHARED}
        />
        <Composition
          id="Act5-Proof"
          component={Act5Proof}
          durationInFrames={750}
          {...SHARED}
        />
        <Composition
          id="Act6-Install"
          component={Act6Install}
          durationInFrames={600}
          {...SHARED}
        />
      </Folder>
    </>
  );
};
