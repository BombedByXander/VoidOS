FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (production only)
RUN bun install --production

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start the application
CMD ["bun", "run", "index.js"]