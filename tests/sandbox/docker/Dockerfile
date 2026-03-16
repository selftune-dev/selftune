# selftune Layer 2 sandbox — based on the official Claude Code devcontainer reference:
# https://code.claude.com/docs/en/devcontainer
# https://github.com/anthropics/claude-code/tree/main/.devcontainer
FROM node:20@sha256:bab3cdce60d2a5ac2d2822947cdd5e267c79503c65c2f05d83911e86bea7d2fc

ARG CLAUDE_CODE_VERSION=latest

# Install system deps (aligned with official devcontainer Dockerfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
  less git procps sudo curl unzip ca-certificates jq \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Give node user sudo (aligned with official devcontainer)
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ENV DEVCONTAINER=true

RUN mkdir -p /app && chown node:node /app
WORKDIR /app

# Install Bun (selftune runtime)
USER node
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.10"
ENV PATH="/home/node/.bun/bin:$PATH"

# Install Claude Code CLI (same method as official devcontainer)
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy project and install deps
USER root
COPY --chown=node:node . .
USER node
RUN bun install

# Sandbox HOME — persisted via named Docker volume for auth/session persistence.
# Claude stores auth at $HOME/.claude/ which is inside this volume.
ENV HOME=/home/node/sandbox
USER root
RUN mkdir -p /home/node/sandbox /app/tests/sandbox/results && \
  chown -R node:node /home/node/sandbox /app/tests/sandbox/results
USER node

# Entrypoint provisions fixtures at runtime (after volumes mount),
# then runs CMD. This lets claude auth persist in the named volume.
COPY --chown=node:node tests/sandbox/docker/entrypoint.sh /home/node/entrypoint.sh
USER root
RUN chmod +x /home/node/entrypoint.sh
USER node

ENTRYPOINT ["/home/node/entrypoint.sh"]
CMD ["bun", "run", "tests/sandbox/docker/run-with-llm.ts"]
