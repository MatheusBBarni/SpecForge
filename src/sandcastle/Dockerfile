FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
  git \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

RUN usermod -d /home/agent -m -l agent node

USER agent
WORKDIR /home/agent/workspace
