#!/bin/sh -eux

ClusterId="dust"

gcloud container clusters describe \
  "$ClusterId" \
| grep "current"

NewVersion="$(gcloud \
  container get-server-config \
| grep -A1 validMasterVersions \
| tail -n1 \
| cut -f2 -d' ')"

gcloud container clusters upgrade \
  "$ClusterId" \
  --cluster-version="$NewVersion" \
  --master

for NodePool in $(gcloud \
  container node-pools list \
  --cluster="$ClusterId" \
| grep -v NAME \
| grep -v "$NewVersion\$" \
| cut -f1 -d' ')
do gcloud \
  container clusters upgrade \
  "$ClusterId" \
  --cluster-version="$NewVersion" \
  --node-pool="$NodePool"
done

gcloud container clusters describe \
  "$ClusterId" \
| grep "current"
