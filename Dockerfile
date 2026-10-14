FROM golang:1.23-alpine AS build
RUN apk add --no-cache unzip
WORKDIR /src
COPY ["Dardashat_Android_Global_Project (1).zip", "/tmp/dardashat-project.zip"]
RUN unzip -q /tmp/dardashat-project.zip -d /src && test -f /src/main.go && test -f /src/go.mod && test -f /src/web/index.html
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/server .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && addgroup -S chat && adduser -S chat -G chat && mkdir -p /data && chown chat:chat /data
COPY --from=build /app/server /usr/local/bin/dardashat
ENV DARDASHAT_CLOUD=1 DARDASHAT_DATA_DIR=/data PORT=10000
USER chat
EXPOSE 10000
CMD ["dardashat"]
