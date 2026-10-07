FROM node:20-alpine
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (only production if needed)
RUN npm ci --omit=dev

# Copy web assets and code
COPY index.html index.css ./
COPY assets/ ./assets/
COPY src/ ./src/
COPY scripts/ ./scripts/

ENV PORT=3000
EXPOSE 3000

CMD ["node", "scripts/serve.js"]
