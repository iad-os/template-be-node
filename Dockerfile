# Install production dependencies
FROM node:22 as depsStage
ARG NODE_ARG_TAG_VERSION
ENV NODE_APP_TAG_VERSION=${NODE_ARG_TAG_VERSION}
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Install build dependencies
FROM node:22 as buildDepsStage
ARG NODE_ARG_TAG_VERSION
ENV NODE_APP_TAG_VERSION=${NODE_ARG_TAG_VERSION}
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Run tests & build
FROM node:22 as buildStage
ARG NODE_ARG_TAG_VERSION
ENV NODE_APP_TAG_VERSION=${NODE_ARG_TAG_VERSION}
WORKDIR /app
COPY . .
COPY --chown=node:node --from=buildDepsStage /app/node_modules ./node_modules
RUN npm run build 
  # \
  # && npm run test


# Stage: image create final image
FROM node:22-alpine
# Create app directory
ARG NODE_ARG_TAG_VERSION
ENV NODE_APP_TAG_VERSION=${NODE_ARG_TAG_VERSION}
WORKDIR /app
COPY --chown=node:node --from=buildStage /app/dist ./dist
# Bundle app source
COPY --chown=node:node --from=depsStage /app/node_modules ./node_modules
COPY --chown=node:node ./package*.json ./
RUN apk --no-cache add curl
USER node
EXPOSE 3000
ENTRYPOINT [ "node", "dist/index.js" ]