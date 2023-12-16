# Use the official Node.js image as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /var/www/html

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run your application
CMD ["node", "bot.js"]