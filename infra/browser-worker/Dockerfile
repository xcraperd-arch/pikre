FROM mcr.microsoft.com/playwright:v1.47.0-jammy
WORKDIR /worker
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
EXPOSE 3001
CMD ["node", "server.js"]
