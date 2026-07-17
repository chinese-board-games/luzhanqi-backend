# Base image used 
FROM node:24.15.0-alpine

WORKDIR /usr/app
COPY ./ /usr/app

# Installing project dependencies
RUN npm install && npm cache clean --force

ENV PATH=./node_modules/.bin:$PATH

# Compile TypeScript for production
RUN npm run build

# Running default command
CMD ["npm", "run", "prod"]