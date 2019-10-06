apt install -y linux-headers-cloud-amd64

echo "deb http://deb.debian.org/debian/ unstable main" > /etc/apt/sources.list.d/unstable.list
printf 'Package: *\nPin: release a=unstable\nPin-Priority: 90\n' > /etc/apt/preferences.d/limit-unstable
apt update

apt install -y wireguard
ip link add dev wg0 type wireguard

umask 066
wg genkey | tee server-private.key | wg pubkey > server-public.key

#wg setconf wg0 /etc/wireguard/wg0.conf
wg-quick up wg0

vim /etc/sysctl.conf
echo 1 > /proc/sys/net/ipv4/ip_forward

iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i wg0 -o wg0 -m conntrack --ctstate NEW -j ACCEPT
iptables -t nat -A POSTROUTING -s 10.169.0.1/24 -o enp0s4 -j MASQUERADE

apt-get install iptables-persistent
systemctl enable netfilter-persistent
netfilter-persistent save

sudo systemctl enable wg-quick@wg0.service
