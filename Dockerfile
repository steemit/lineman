FROM node:8

WORKDIR /app
COPY . .

RUN yarn install --non-interactive --frozen-lockfile

RUN make ci-test
RUN make lib

# prune modules
RUN yarn install --non-interactive --frozen-lockfile --production

EXPOSE 8080

ENV PORT 8080
ENV NODE_ENV production

CMD [ "node", "lib/server.js" ]
