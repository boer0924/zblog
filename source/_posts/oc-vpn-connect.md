---
title: Openconnect VPN
date: 2020-05-10 10:20:06
index_img: https://picsum.photos/300/200.webp?ocvpn
tags:
  - boer
  - DevOps
categories: DevOps
---
2020年已注定是不平凡的一年
新冠肺炎疫情
科比逝世
......

疫情影响下各个公司启动远程办公，VPN成了必不可少的服务。
Openconnect server (ocserv) is an SSL VPN server for administrators who require elaborate user management and control. Openconnect server provides user management interfaces and back-ends necessary in enterprise environments, as well as security features, such as isolation of connected clients, features currently not available to any existing VPN servers.
http://www.infradead.org/openconnect/

<!-- more -->
### 1. 安装ocserv
```bash
# ocserv 已经在epel仓库中提供了，所以可以直接通过yum安装
yum install epel-release
yum install ocserv
```

### 2. 创建 CA
```bash
cd /etc/ocserv
mkdir CA
cd CA
## Root CA
vim ca.tmpl
cn = "boer" 
organization = "boer" 
serial = 1 
expiration_days = 3650
ca 
signing_key 
cert_signing_key 
crl_signing_key
# Root CA 密钥
certtool --generate-privkey --outfile ca-key.pem
# 签发证书
certtool --generate-self-signed --load-privkey ca-key.pem --template ca.tmpl --outfile ca-cert.pem

## Server CA
vim server.tmpl
#cn 为服务器密码或者执行该服务器的域名
cn = "vpn.boer.xyz" 
organization = "boer" 
expiration_days = 3650
signing_key 
encryption_key
tls_www_server
# Server 密钥
certtool --generate-privkey --outfile server-key.pem
# 签发证书
certtool --generate-certificate --load-privkey server-key.pem --load-ca-certificate ca-cert.pem --load-ca-privkey ca-key.pem --template server.tmpl --outfile server-cert.pem

# 证书路径（上述步骤创建）：
/etc/ocserv/CA/ca-cert.pem 
/etc/ocserv/CA/server-cert.pem
/etc/ocserv/CA/server-key.pem
```

### 3. 配置文件
```bash
# 创建路由分组管理目录
mkdir -p /etc/ocserv/group
vim /etc/ocserv/ocserv.conf
auth = "plain[/etc/ocserv/ocpasswd]"
tcp-port = 443 # *
run-as-user = ocserv
run-as-group = ocserv
config-per-group = /etc/ocserv/group/ # *
default-group-config = /etc/ocserv/group/Default
default-select-group = Default
auto-select-group = false 
socket-file = ocserv.sock
chroot-dir = /var/lib/ocserv
isolate-workers = true
max-clients = 50 # *
max-same-clients = 2
keepalive = 32400
dpd = 90
mobile-dpd = 1800
switch-to-tcp-timeout = 25
try-mtu-discovery = true # false
server-cert = /etc/ocserv/CA/server-cert.pem # *
server-key = /etc/ocserv/CA/server-key.pem # *
ca-cert = /etc/ocserv/CA/ca-cert.pem # *
cert-user-oid = 2.5.4.3 # 0.9.2342.19200300.100.1.1
tls-priorities = "NORMAL:%SERVER_PRECEDENCE:%COMPAT:-VERS-SSL3.0"
auth-timeout = 240
min-reauth-time = 300
max-ban-score = 0
ban-reset-time = 300
cookie-timeout = 300
deny-roaming = false
rekey-time = 172800
rekey-method = ssl
use-occtl = true
pid-file = /var/run/ocserv.pid
device = vpns
predictable-ips = true
default-domain = boer.xyz # *
ipv4-network = 192.168.5.0/24 # *
dns = 192.168.5.1 # * 自建dns服务
split-dns = *.boer.xyz # *
ping-leases = false
cisco-client-compat = true
dtls-legacy = true
user-profile = profile.xml

# 创建一个登陆用的用户名与密码
ocpasswd -c /etc/ocserv/ocpasswd boer
```

### 4. 转发与安全配置
network 192.169.5.0/24 为/etc/ocserv/ocserv.conf中的ipv4-network = 192.168.5.0/24 
ocserv WAN interface 为eth0
#### 4.1 修改内核配置
```bash
vim /etc/sysctl.conf
# Protect from IP Spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Protect from bad icmp error messages
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# Turn on exec shield
kernel.exec-shield = 1
kernel.randomize_va_space = 1

# Block SYN attacks
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Log Martians
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0

net.ipv6.conf.all.accept_ra = 2
net.ipv6.conf.eth0.accept_ra = 2

net.ipv4.ip_forward = 1
```
使之生效： sysctl -p

#### 4.2 IPtables
```bash
systemctl stop firewalld
systemctl disable firewalld
yum install iptables 
systemcctl start iptables
systemcctl enable iptables
```

### 4.3 IPtables配置
```bash 
vim /etc/sysconfig/iptables
# sample configuration for iptables service
# you can edit this manually or use system-config-firewall
# please do not ask us to add additional ports/services to this default configuration
#*filter
#:INPUT ACCEPT [0:0]
#:FORWARD ACCEPT [0:0]
#:OUTPUT ACCEPT [0:0]
#-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
#-A INPUT -p icmp -j ACCEPT
#-A INPUT -i lo -j ACCEPT
#-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
#-A INPUT -j REJECT --reject-with icmp-host-prohibited
#-A FORWARD -j REJECT --reject-with icmp-host-prohibited
#COMMIT
#
*nat
:INPUT ACCEPT [0:0]
:PREROUTING ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
# Generic NAT for LAN Network 192.168.5.0/24
-A POSTROUTING -s 192.168.5.0/24 -o eth0 -j MASQUERADE
COMMIT

*mangle
:PREROUTING ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
COMMIT

*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
# START INPUT RULES
# Stateful Rule - INPUT
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
# ACCEPT traffic from Loopback interface
-A INPUT -i lo -j ACCEPT
# ACCEPT SSH from LAN
-A INPUT -p tcp -m tcp -i eth0 --dport 22 -j ACCEPT
# ACCEPT DHCP from LAN
-A INPUT -p udp -m udp -i eth1 --dport 67:68 -j ACCEPT
# ACCEPT Webmin from LAN (Optional, only for Webmin users)
-A INPUT -p tcp -m tcp -i eth0 --dport 10000 -j ACCEPT
# ACCEPT DNS UDP From LAN
-A INPUT -p udp -m udp -i eth0 --dport 53 -j ACCEPT
# ACCEPT DNS TCP From LAN
-A INPUT -p tcp -m tcp -i eth0 --dport 53 -j ACCEPT
# ACCEPT ping from LAN
-A INPUT -p icmp --icmp-type echo-request -i eth1 -j ACCEPT
# ACCEPT OpenConnect TCP From WAN
-A INPUT -p tcp -m tcp -i eth0 --dport 443 -j ACCEPT
# ACCEPT OpenConnect UPD From WAN
-A INPUT -p udp -m udp -i eth0 --dport 443 -j ACCEPT
# DROP wan traffic
-A INPUT -i eth0 -j DROP
# LOG LAN
-A INPUT -i eth1 -j LOG --log-prefix "IPTABLES-LOG-INPUT-LAN:" --log-level 4
# ACCEPT LAN traffic - Learning rule - Should be changed to DROP once custom rules are created.
-A INPUT -i eth1 -j ACCEPT
# LAST RULE - DROP all traffic
-A INPUT -j DROP
# END INPUT RULES

# START FORWARD RULES
# Stateful Rule - FORWARD
-A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
# ACCEPT LAN to WAN
-A FORWARD -s 192.168.5.0/24 -j ACCEPT
# LOG Forwarded traffic
-A FORWARD -j LOG --log-prefix "IPTABLES-LOG-FORWARD:" --log-level 4
# LAST RULE - ACCEPT all traffic - Should be changed to DROP once custom rules are created.
-A FORWARD -j ACCEPT
# END FORWARD RULES

# START OUTPUT RULES
# Stateful Rule - OUTPUT
-A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
# LOG Outgoing traffic
-A OUTPUT -j LOG --log-prefix "IPTABLES-LOG-OUTPUT:" --log-level 4
# LAST RULE - ACCEPT all traffic - Should be    changed to DROP once custom rules are created.
-A OUTPUT -j ACCEPT
# END OUTPUT RULES
COMMIT
```
使之生效【重启机器后需要重新生效一下】
iptables-restore < /etc/sysconfig/iptables

### 5.ocserv Oops
```bash
# 添加用户
ocpasswd -c /etc/ocserv/ocpasswd 【用户名】
# 添加用户至某个分组
ocpasswd -c /etc/ocserv/ocpasswd -g 【分组名称】 【用户名】
# 锁定用户
ocpasswd -c /etc/ocserv/ocpasswd -l 【用户名】
# 解锁用户
ocpasswd -c /etc/ocserv/ocpasswd -u 【用户名】
# 删除用户
ocpasswd -c /etc/ocserv/ocpasswd -d 【用户名】

# 查看当前状态:
## 查看当前服务运行状态:
occtl -n show status
## 查看当前在线用户详情:
occtl -n show users

# 踢掉当前在线用户:
## 通过用户名:
occtl disconnect user 【用户名】
## 通过id:
occtl disconnect id 【id号】
```

### 6 客户端
#### 6.1 Redhat系
```
https://copr.fedorainfracloud.org/coprs/dwmw2/openconnect/
yum install openconnect
openconnect --user=boer -b x.x.x.x:xyz
```
#### 6.2 Windows & MacOS
https://github.com/openconnect/openconnect-gui