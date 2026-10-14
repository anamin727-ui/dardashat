FROM golang:1.23-alpine AS builder
RUN apk add --no-cache unzip
WORKDIR /src
COPY Dardashat_Android_Global_Project.zip /src/project.zip
RUN unzip -q /src/project.zip -d /src && go build -trimpath -ldflags="-s -w" -o /server .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && addgroup -S chat && adduser -S chat -G chat && mkdir -p /data && chown chat:chat /data
COPY --from=builder /server /usr/local/bin/dardashat
ENV DARDASHAT_CLOUD=1 DARDASHAT_DATA_DIR=/data PORT=8080
USER chat
EXPOSE 8080
CMD ["dardashat"]
