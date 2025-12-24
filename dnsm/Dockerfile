FROM node:24.12.0-alpine
WORKDIR /app/dnsm
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]