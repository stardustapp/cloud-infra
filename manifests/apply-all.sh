#!/bin/sh -ex

#go get github.com/kubernetes-sigs/kustomize/cmd/kustomize

#kustomize build manifests/datadog-agent | kubectl apply -f -
kubectl apply -k manifests/dust-domain
kubectl apply -k manifests/dust-poc
kustomize build manifests/ingress-internet | kubectl apply -f -
kubectl apply -k manifests/ingress-internet-clouddns
kustomize build manifests/ingress-wg69 | kubectl apply -f -
kubectl apply -k manifests/ingress-wg69-clouddns
kubectl apply -k manifests/lambdabot
kubectl apply -k manifests/media
kustomize build manifests/nagios | kubectl apply -f -
kubectl apply -k manifests/reggie
kustomize build manifests/starnotify | kubectl apply -f -
kubectl apply -k manifests/wg69
