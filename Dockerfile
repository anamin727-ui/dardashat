FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY parts/ /src/parts/
RUN cat parts/*.txt | base64 -d | tar -xz -C /src
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /server .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && addgroup -S chat && adduser -S chat -G chat && mkdir -p /data && chown chat:chat /data
COPY --from=builder /server /usr/local/bin/dardashat
ENV DARDASHAT_CLOUD=1 DARDASHAT_DATA_DIR=/data PORT=8080
USER chat
EXPOSE 8080
CMD ["dardashat"]
