FROM node:8.17.0-stretch
WORKDIR .
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "node", "app.js" ]