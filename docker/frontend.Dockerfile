FROM node:20-alpine

WORKDIR /app

# Copy package configuration files
# We assume the build context is the `frontend` folder
COPY package.json package-lock.json* ./

# Install dependencies cleanly
RUN npm install

# Copy all application files
COPY . .

# Build the Next.js app for production
RUN npm run build

# Expose Next.js port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
