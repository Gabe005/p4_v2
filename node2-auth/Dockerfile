FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose ports for REST and gRPC
EXPOSE 3001 50051

# Start the service
CMD ["node", "server.js"]