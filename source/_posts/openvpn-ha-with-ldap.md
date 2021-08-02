---
title: OpenVPN with ldap认证实践
date: 2021-07-28 10:50:16
index_img: https://picsum.photos/300/200.webp?openvpn
tags:
  - OpenVPN
  - VPN
  - ocserv
categories: DevOps
---
个人VPN青睐排行：
OpenConnect VPN Server(OCServ)
WireGuard
OpenVPN

OpenVPN社区版实践笔记https://openvpn.net/community/
高可用的思考：
保证多个实例证书相同(easy-rsa工具生成证书拷贝到多个实例)
1、在客户端配置多个remote，且随机选择remote-random
2、HAProxy负载均衡代理

<!-- more -->

### 安装
```bash
### 版本
# easy-rsa 3.0.8
# openvpn-auth-ldap 2.0.3
# openvpn 2.4.11
yum install openvpn easy-rsa iptables-services
```

### 证书
```bash
mkdir /etc/openvpn/server/easy-rsa
cp -r /usr/share/easy-rsa/3.0.8/* /etc/openvpn/server/easy-rsa/
cp /usr/share/doc/easy-rsa-3.0.8/vars.example /etc/openvpn/server/easy-rsa/vars
###
# vim /etc/openvpn/server/easy-rsa/vars
set_var EASYRSA_REQ_COUNTRY	"CN"
set_var EASYRSA_REQ_PROVINCE	"Chongqing"
set_var EASYRSA_REQ_CITY	"Chongqing"
set_var EASYRSA_REQ_ORG		"Boer Inc."
set_var EASYRSA_REQ_EMAIL	"boer0924@gmail.com"
set_var EASYRSA_REQ_OU		"boer"
set_var EASYRSA_KEY_SIZE	2048
set_var EASYRSA_ALGO		rsa
set_var EASYRSA_CA_EXPIRE	36500
set_var EASYRSA_CERT_EXPIRE	36500

source ./vars
###
./easyrsa init-pki

./easyrsa build-ca nopass # boer

./easyrsa gen-dh

./easyrsa build-server-full server nopass
./easyrsa build-client-full client nopass # client/用户

mkdir /etc/openvpn/server/certs/
cp -r ca.crt dh.pem issued/*.crt private/*.key /etc/openvpn/server/certs/
cd /etc/openvpn/server
openvpn --genkey --secret ta.key
cp ta.key /etc/openvpn/server/certs/
```

### 服务端
- https://github.com/OpenVPN/openvpn/blob/master/sample/sample-config-files/server.conf
- https://github.com/OpenVPN/openvpn/blob/v2.4.11/sample/sample-config-files/server.conf

```conf
### /etc/openvpn/server
### touch server.conf
local 10.10.253.16
port 1194

; proto udp
proto tcp

; 使用三层路由IP隧道(tun)还是二层以太网隧道(tap)。一般都使用tun
dev tun

persist-key
persist-tun

ca certs/ca.crt
cert certs/server.crt
key certs/server.key
dh certs/dh.pem
tls-auth certs/ta.key 0

duplicate-cn

cipher AES-256-CBC

; comp-lzo
compress lz4-v2
push "compress lz4-v2"

ifconfig-pool-persist ipp.txt
server 172.30.1.0 255.255.255.0
; push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 223.5.5.5"
push "dhcp-option DNS 223.6.6.6"
; vpn服务端向客户端推送vpn服务端内网网段的路由配置，以便让客户端能够找到服务端内网。多条路由就写多个Push指令
client-config-dir ccd
push "route 10.0.0.0 255.255.0.0"
push "route 10.96.0.0 255.240.0.0"
max-clients 100
; 让vpn客户端之间可以互相看见对方，即能互相通信。默认情况客户端只能看到服务端一个人,默认是注释的，不能客户端之间相互看见
client-to-client

; user openvpn
; group openvpn
keepalive 10 120
status openvpn-status.log
log openvpn.log
verb 3
; explicit-exit-notify 1
plugin /usr/lib64/openvpn/plugin/lib/openvpn-auth-ldap.so /etc/openvpn/auth/ldap.conf # openvpn-auth-ldap
client-cert-not-required # ldap auth
```

### LDAP配置
```conf
<LDAP>
	URL		ldap://10.10.253.16:10389
	BindDN		cn=admin,dc=boer,dc=xyz
	Password	<your_password>
	Timeout		15
	TLSEnable	no
	FollowReferrals no
</LDAP>

<Authorization>
	BaseDN		"ou=users,dc=boer,dc=xyz"
	SearchFilter	"uid=%u"
	RequireGroup	false # 2.0.3bug
	<Group>
		BaseDN		"ou=groups,dc=boer,dc=xyz"
		SearchFilter	"(|(cn=developers)(cn=devops))"
		MemberAttribute	memberUid
	</Group>
</Authorization>
```

启动服务`systemctl start openvpn-server@server.service`

### 客户端
- https://openvpn.net/community-downloads/
- https://github.com/OpenVPN/openvpn/blob/v2.4.11/sample/sample-config-files/client.conf

1、下载服务端证书到本地
- ca.crt
- ta.key
- client.crt [可选]
- client.key [可选]

2、配置文件
```conf
### Windows client.ovpn
client
;dev tap
dev tun
proto tcp
;proto udp
remote 10.10.253.16 1194
;remote my-server-2 1194
;remote-random
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
; cert client.crt
; key client.key
auth-user-pass # ldap auth
remote-cert-tls server
tls-auth ta.key 1
cipher AES-256-CBC
verb 3
```

### 他山之石
- https://www.mtyun.com/library/how-to-install-OpenVPN
- [在 CentOS7 上搭建 OpenVPN 服务端并添加用户](http://www.itca.cc/VPN%E6%90%AD%E5%BB%BA/openvpn-1.html)
- [OpenVPN 设置账号密码登录](https://i4t.com/4485.html)
- [基于用户名/密码认证和流量控制的OpenVPN系统配置](https://www.liujason.com/old-blog/1698.html)
- [OpenVPN集成LDAP认证](https://blog.frognew.com/2017/09/openvpn-integration-ldap.html)
- https://mrpastor.github.io/2018-02-03/openvpn%E6%9D%83%E9%99%90%E6%8E%A7%E5%88%B6%E9%85%8D%E7%BD%AE/
- https://blog.nuface.tw/?p=1347