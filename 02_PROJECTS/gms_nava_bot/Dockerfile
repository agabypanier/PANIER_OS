# GMS/NAVA Telegram Bot - Docker Image
FROM node:20-alpine

# Install dependencies
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories for persistent data
RUN mkdir -p /data /app/generated_pdfs

# Use a volume for persistent data (bot.db + generated PDFs)
VOLUME ["/data"]

# Environment variables (set in Railway dashboard)
ENV NODE_ENV=production

# Start the bot
CMD ["node", "index.js"]
