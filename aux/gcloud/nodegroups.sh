#!/bin/sh

gcloud container \
  node-pools create micro2 \
  --disk-size 10GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type f1-micro \
  --max-pods-per-node 25 \
  --num-nodes 2 \
  --node-labels purpose=app \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 3

gcloud container \
  node-pools create small4 \
  --disk-size 10GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type g1-small \
  --max-pods-per-node 25 \
  --preemptible \
  --num-nodes 1 \
  --node-labels purpose=app

gcloud container \
  node-pools create build1 \
  --disk-size 25GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type n1-standard-1 \
  --max-pods-per-node 25 \
  --num-nodes 0 \
  --node-labels purpose=build \
  --node-taints cloud.google.com/gke-preemptible="true":NoSchedule \
  --preemptible \
  --enable-autoscaling \
  --min-nodes 0 \
  --max-nodes 1 \
  --service-account build-node@stardust-156404.iam.gserviceaccount.com
