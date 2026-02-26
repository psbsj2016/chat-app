# 1. Obriga o servidor a baixar um motor Linux com Node.js 18 instalado
FROM node:18-alpine

# 2. Cria a pasta de trabalho da nossa base
WORKDIR /app

# 3. Copia o "Bilhete de Identidade" para dentro do servidor
COPY package.json ./

# 4. Instala as peças originais (npm)
RUN npm install

# 5. Copia todo o nosso SuperApp para dentro do servidor
COPY . .

# 6. Abre as portas blindadas de comunicação
ENV PORT=8080
EXPOSE 8080

# 7. A Ordem Final: Liga o motor!
CMD ["node", "server.js"]