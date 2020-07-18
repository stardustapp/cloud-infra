FROM mhart/alpine-node:12

# Add system deps
RUN apk add --no-cache python build-base

# Add system utils
RUN wget -P /bin http://dist.stardustapp.run.s3.amazonaws.com/core-utils/starnotify \
 && chmod +x /bin/starnotify

# Add node deps
ADD package*.json ./
RUN npm install

# Add source files
ADD src src
CMD ["node"]
