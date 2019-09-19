#!/bin/sh

gcloud container \
  clusters create dust \
  --create-subnetwork name=dust \
  --version 1.13.7-gke.24 \
  --disk-size 10GB \
  --default-max-pods-per-node 30 \
  --enable-ip-alias \
  --image-type COS \
  --machine-type g1-small \
  --maintenance-window 10:23 \
  --num-nodes 1 \
  --addons HorizontalPodAutoscaling

gcloud container \
  node-pools delete \
  default-pool
