# Use official Node.js image
FROM node:20 AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript files
RUN npm run build

# Stage 2: Use a lightweight Node.js image to run the app
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install necessary Linux CLI tools
RUN apk add --no-cache festival lame

# Copy only the built files from the previous stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/swagger.json ./
COPY --from=builder /usr/src/app/.env ./
COPY --from=builder /usr/src/app/codeVideoAsciiArt.txt ./

# Install production dependencies
RUN npm install --only=production

# Expose port 7000
EXPOSE 7000

# Command to run your app
CMD ["node", "./dist/index.js"]
