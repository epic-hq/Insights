FROM node:20-slim
WORKDIR /srv
COPY cms/package*.json ./cms/
RUN cd cms && npm ci --omit=dev
COPY cms ./cms
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "cms/server.js"]
