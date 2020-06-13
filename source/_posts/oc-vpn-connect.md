---
title: Openconnect VPN
date: 2020-05-10 10:20:06
imdex_img: https://picsum.photos/300/200.webp?ocvpn
tags:
  - boer
  - DevOps
categories: DevOps
---
Openconnect server (ocserv) is an SSL VPN server for administrators who require elaborate user management and control. Openconnect server provides user management interfaces and back-ends necessary in enterprise environments, as well as security features, such as isolation of connected clients, features currently not available to any existing VPN servers.

<!-- more -->

```
https://copr.fedorainfracloud.org/coprs/dwmw2/openconnect/
yum install openconnect
openconnect --user=boer -b x.x.x.x:xyz
```