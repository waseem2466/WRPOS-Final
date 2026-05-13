# Use Node.js LTS
FROM node:18-slim

# Install dependencies for native modules and basic utilities
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy necessary bot components
COPY bot-server.js ./
COPY aiReply.js ./
COPY dbHelper.js ./
COPY intent.js ./
COPY invoice.js ./
COPY shopData.js ./

# Create data directory for ephemeral session data
# Note: Koyeb Nano tier does not persist this directory across restarts.
RUN mkdir -p data

# Koyeb uses the PORT environment variable (defaults to 8000 often, but we handle dynamic PORT)
# We expose a common port, but the app listens on process.env.PORT
EXPOSE 8000

# Start the bot server
CMD ["node", "bot-server.js"]
