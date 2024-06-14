FROM node:18 as runner

WORKDIR /app

COPY . .

RUN npm install

CMD ["npm", "start"]





