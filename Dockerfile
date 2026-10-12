FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
ENV NODE_ENV=production PORT=3000 ACCOUNT_DATA_DIR=/app/.data REQUIRE_LOGIN=true TRUST_PROXY=true
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/dev-server.mjs", "--lan"]
