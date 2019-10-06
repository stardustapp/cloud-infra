sudo ip address add dev wg0 10.169.0.10/32
sudo wg setconf wg0 dellbox/wg0.conf
ip link set up dev wg0
sudo ip route add 10.8.0.0/20 dev wg0
