FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i --only=production
COPY src ./src
EXPOSE 3000
CMD ["npm", "start"]