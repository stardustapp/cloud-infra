#!/bin/sh

gcloud compute \
  firewall-rules create gke-world-http \
  --description="Allow public access to the GKE nodes for nginx ingress purposes" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=gke-dust-99f28f8f-node
