FROM golang:1.15 AS build-go
WORKDIR /src
# cache deps
ADD go.* /src/
RUN go mod download
# build module
ADD * /src/
RUN go build -o /bin/nagios-api-checks

# pack into minimal image
FROM gcr.io/distroless/base
COPY --from=build-go /bin/nagios-api-checks /bin/
CMD ["/bin/nagios-api-checks"]
