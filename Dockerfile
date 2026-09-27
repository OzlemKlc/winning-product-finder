# Winning Product Finder — üretim imajı
# Küçük, çok-aşamalı olmayan basit imaj (uygulama zaten hafif ve bağımlılıksız çekirdeğe sahip).

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Önce manifest → bağımlılık katmanını cache'le
COPY package.json ./
# pg opsiyonel; yoksa demo modda çalışmayı sürdürür
RUN npm install --omit=dev --no-audit --no-fund || true

# Uygulama kaynağı
COPY . .

EXPOSE 4545

# Basit healthcheck — /health uç noktası
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4545)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
