#!/bin/sh -eux

mode=$1

kubectl $mode -k namespaces/code/code-server
#kustomize build namespaces/datadog-agent | kubectl $mode -f -
kubectl $mode -k namespaces/default/lambdabot
kubectl $mode -k namespaces/default/reggie
kubectl $mode -k namespaces/drone-builds
kubectl $mode -k namespaces/drone-gitea
kubectl $mode -k namespaces/dust-poc
kustomize build namespaces/ingress-internet/nginx | kubectl $mode -f -
kubectl $mode -k namespaces/ingress-internet/dns
kubectl $mode -k namespaces/ingress-internet/dns-sync
kustomize build namespaces/ingress-wg69/nginx | kubectl $mode -f -
kubectl $mode -k namespaces/ingress-wg69/dns
kubectl $mode -k namespaces/ingress-wg69/dns-sync
kubectl $mode -k namespaces/kube-pets
kubectl $mode -k namespaces/kube-system/amazon-pod-identity
kubectl $mode -k namespaces/media
kustomize build namespaces/nagios | kubectl $mode -f -
kubectl $mode -k namespaces/skychat
kustomize build namespaces/starnotify | kubectl $mode -f -
kubectl $mode -k namespaces/wg69
