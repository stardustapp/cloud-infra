#!/bin/sh -ex

go get github.com/kubernetes-sigs/kustomize/cmd/kustomize

kustomize build dust-domain | kubectl apply -f -
kustomize build ingress-nginx | kubectl apply -f -
