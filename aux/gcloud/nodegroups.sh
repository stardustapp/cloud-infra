#!/bin/sh

# gcloud container \
#   node-pools create micro2 \
#   --disk-size 10GB \
#   --enable-autorepair \
#   --enable-autoupgrade \
#   --image-type COS_CONTAINERD \
#   --machine-type f1-micro \
#   --max-pods-per-node 25 \
#   --num-nodes 2 \
#   --node-labels purpose=app \
#   --enable-autoscaling \
#   --min-nodes 1 \
#   --max-nodes 3

gcloud container \
  node-pools create small5 \
  --disk-size 10GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type g1-small \
  --max-pods-per-node 25 \
  --preemptible \
  --enable-autoscaling \
  --min-nodes 0 \
  --max-nodes 2 \
  --node-labels purpose=app,lifetime=preemptible \
  --node-taints cloud.google.com/gke-preemptible="true":PreferNoSchedule

gcloud container \
  node-pools create persist1 \
  --disk-size 15GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type g1-small \
  --max-pods-per-node 25 \
  --num-nodes 1 \
  --node-labels purpose=app,lifetime=persistent \
  --node-taints cloud.google.com/gke-preemptible="false":PreferNoSchedule

gcloud container \
  node-pools create build3 \
  --disk-size 25GB \
  --disk-type pd-ssd \
  --enable-autorepair \
  --enable-autoupgrade \
  --image-type COS_CONTAINERD \
  --machine-type n1-standard-2 \
  --max-pods-per-node 25 \
  --num-nodes 0 \
  --node-labels purpose=build,lifetime=preemptible \
  --node-taints cloud.google.com/gke-preemptible="true":NoSchedule \
  --preemptible \
  --enable-autoscaling \
  --min-nodes 0 \
  --max-nodes 1 \
  --service-account build-node@stardust-156404.iam.gserviceaccount.com
