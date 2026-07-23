FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json server.js ./
ENV PORT=9090
EXPOSE 9090
CMD ["node", "server.js"]
