FROM node:18-alpine

WORKDIR /app

# Copy package definitions and project sources
COPY package.json ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY tests/ ./tests/
COPY README.md RFC.md LICENSE ./

# Verify build and tests during image creation
RUN npm run build && npm test

# Default execution runs build
CMD ["npm", "run", "build"]
