#!/bin/sh -ex

#go get github.com/kubernetes-sigs/kustomize/cmd/kustomize

kustomize build manifests/datadog-agent | kubectl apply -f -
kubectl apply -k manifests/dust-domain
kubectl apply -k manifests/dust-poc
kubectl apply -k manifests/external-dns
kustomize build manifests/ingress-internet | kubectl apply -f -
kustomize build manifests/ingress-wg69 | kubectl apply -f -
kustomize build manifests/lambdabot | kubectl apply -f -
kustomize build manifests/nagios | kubectl apply -f -
kustomize build manifests/reggie | kubectl apply -f -
kustomize build manifests/starnotify | kubectl apply -f -
kustomize build manifests/wg69 | kubectl apply -f -
