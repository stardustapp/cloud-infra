#!/bin/sh -ex

#go get github.com/kubernetes-sigs/kustomize/cmd/kustomize

kubectl apply -k manifests/amazon-pod-identity
kubectl apply -k manifests/code/code-server
#kustomize build manifests/datadog-agent | kubectl apply -f -
kubectl apply -k manifests/drone-builds
kubectl apply -k manifests/drone-gitea
kubectl apply -k manifests/dust-poc
kustomize build manifests/ingress-internet/nginx | kubectl apply -f -
kubectl apply -k manifests/ingress-internet/dns
kubectl apply -k manifests/ingress-internet/dns-sync
kustomize build manifests/ingress-wg69 | kubectl apply -f -
kubectl apply -k manifests/ingress-wg69-clouddns
kubectl apply -k manifests/kube-pets/blockdevices
kubectl apply -k manifests/lambdabot
kubectl apply -k manifests/media
kustomize build manifests/nagios | kubectl apply -f -
kubectl apply -k manifests/reggie
kubectl apply -k manifests/skychat
kustomize build manifests/starnotify | kubectl apply -f -
kubectl apply -k manifests/wg69
