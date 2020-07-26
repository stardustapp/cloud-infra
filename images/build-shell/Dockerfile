FROM docker:dind
RUN apk add --no-cache python2 git bash vim bind-tools
WORKDIR /root

ARG CloudSdkPath=dl/cloudsdk/channels/rapid/downloads/
ARG CloudSdkFile=google-cloud-sdk-246.0.0-linux-x86_64.tar.gz
RUN wget "https://dl.google.com/${CloudSdkPath}${CloudSdkFile}" \
 && tar -xf "${CloudSdkFile}" \
 && rm "${CloudSdkFile}" \
 && ./google-cloud-sdk/install.sh

ARG KustomizePath=https://api.github.com/repos/kubernetes-sigs/kustomize
RUN wget $KustomizePath/releases -O - \
    | grep browser_download \
    | grep kustomize_v \
    | grep linux \
    | cut -d '"' -f 4 \
    | xargs wget -O /bin/kustomize \
 && chmod +x /bin/kustomize

ENV PATH="/root/google-cloud-sdk/bin:${PATH}"
RUN echo 'export PATH="/root/google-cloud-sdk/bin:${PATH}"' \
    >> /root/.bashrc

RUN gcloud init \
 && gcloud components install kubectl \
 && gcloud auth configure-docker \
 && gcloud container clusters get-credentials dust --zone us-central1-f
