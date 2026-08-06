# Step 1: Use official Node.js image
FROM node:18-alpine

# Step 2: Set working directory inside container
WORKDIR /app

# Step 3: Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy all source code
COPY . .

# Step 6: Build TypeScript into dist/
RUN npm run build

# Step 7: Expose backend port
EXPOSE 5000

# Step 8: Run compiled server
CMD ["npm", "start"]
