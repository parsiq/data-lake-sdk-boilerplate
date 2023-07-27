FROM node:16-alpine AS datalake-template-dev
RUN apk add bash
RUN npm install --global wait-port
RUN mkdir -p /home/node/runner && chown -R node:node /home/node/runner
USER node
WORKDIR /home/node/runner
RUN mkdir -p /home/node/runner/dist
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node local_packages/ ./local_packages/
RUN npm ci --ignore-scripts
COPY --chown=node:node tsconfig.json run.sh main.ts ./
COPY --chown=node:node src/ ./src/
RUN npx tsc
RUN rm -rf package.json package-lock.json local_packages/ tsconfig.json main.ts src/
