#!/bin/sh -e
kubectl get namespaces \
| grep Active \
| cut -d' ' -f1 \
| xargs -n1 \
  -- kubectl top pods -n
