#!/bin/sh -e

cat > print-cont-os.sh <<EOF
#!/bin/sh
echo -n "\$1    \$2    "
OS_NAME=\$(kubectl exec -n \$1 \$2 -c \$3 \
  /bin/cat /etc/os-release 2>&1 \
| grep PRETTY_NAME)
if [ -z "\$OS_NAME" ]
then echo N/A
else echo \$OS_NAME | cut -d'"' -f2
fi
EOF
chmod +x print-cont-os.sh

cat > print-pod-os.sh <<EOF
#!/bin/sh -e
kubectl describe -n \$1 pod \$2 \
| grep -B1 'Container ID' \
| grep -E ':\$' \
| cut -d':' -f1 \
| xargs -n1 ./print-cont-os.sh \$1 \$2
EOF
chmod +x print-pod-os.sh

cat > list-os-ns.sh <<EOF
#!/bin/sh -e
kubectl get pods -n \$1 2>&1 \
| grep Running \
| cut -d' ' -f1 \
| xargs -n1 ./print-pod-os.sh \$1
EOF
chmod +x list-os-ns.sh

kubectl get namespaces \
| grep Active \
| cut -d' ' -f1 \
| xargs -n1 ./list-os-ns.sh

rm print-cont-os.sh print-pod-os.sh list-os-ns.sh
