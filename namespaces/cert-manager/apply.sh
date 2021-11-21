#!/bin/sh -ex

kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.6.1/cert-manager.yaml
kubectl apply -f dns-sync-issuer.yaml
