#!/bin/sh -ux

mode=$1

# kubectl $mode -k namespaces/code/code-server
# kubectl $mode -k namespaces/default/lambdabot
kubectl $mode -k namespaces/default/reggie
# kubectl $mode -k namespaces/dust-poc
kubectl $mode -k namespaces/ingress-internet/nginx
kubectl $mode -k namespaces/ingress-internet/dns-sync
# kubectl $mode -k namespaces/ingress-wg69/nginx
# kubectl $mode -k namespaces/ingress-wg69/dns-sync
kubectl $mode -k namespaces/kube-pets
# kubectl $mode -k namespaces/kube-system/amazon-pod-identity
# kubectl $mode -k namespaces/media
kubectl $mode -k namespaces/monitoring
kubectl $mode -k namespaces/nagios
kubectl $mode -k namespaces/skychat
kubectl $mode -k namespaces/starnotify
# kubectl $mode -k namespaces/wg69

# kubectl $mode -f "https://kubernetes-aws-identity.deno.dev/webhook-config.yaml"
kubectl $mode -f https://raw.githubusercontent.com/kubernetes-sigs/external-dns/master/docs/contributing/crd-source/crd-manifest.yaml
