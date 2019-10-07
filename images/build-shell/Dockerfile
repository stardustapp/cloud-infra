FROM docker:dind
RUN apk add python2 git bash vim
WORKDIR /root

ARG CloudSdkPath=dl/cloudsdk/channels/rapid/downloads/
ARG CloudSdkFile=google-cloud-sdk-246.0.0-linux-x86_64.tar.gz
RUN wget "https://dl.google.com/${CloudSdkPath}${CloudSdkFile}" && \
    tar -xf "${CloudSdkFile}" && \
    rm "${CloudSdkFile}" && \
    ./google-cloud-sdk/install.sh

ENV PATH="/root/google-cloud-sdk/bin:${PATH}"
RUN gcloud init && \
    gcloud components install kubectl && \
    gcloud auth configure-docker && \
    gcloud container clusters get-credentials dust --zone us-central1-f
