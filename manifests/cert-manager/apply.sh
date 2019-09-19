#!/bin/sh -ex

kubectl apply -f namespace.yaml
kubectl apply -f bundle.yaml
kubectl apply -f letsencrypt.yaml
