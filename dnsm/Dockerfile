FROM node:24.12.0-alpine
WORKDIR /app/dnsm
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build
RUN ln -s /app/dnsm/dist/bin/cli.js /bin/dnsm
RUN chmod +x /bin/dnsm
CMD ["npm", "start"]