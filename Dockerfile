# Base image used 
FROM node:21

WORKDIR /usr/app
COPY ./ /usr/app

# Installing project dependencies
RUN npm install && npm cache clean --force

ENV PATH=./node_modules/.bin:$PATH

# Running default command 
CMD ["npm", "run", "dev"]