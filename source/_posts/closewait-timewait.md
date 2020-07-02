---
title: TCP - CLOSE_WAIT & TIME_WAIT
date: 2018-01-18 18:16:16
index_img: https://picsum.photos/300/200.webp?closetime
tags:
  - TCP/IP
  - TCP四次挥手
  - CLOSE_WAIT
  - TIME_WAIT
categories: DevOps
---
### 一图胜千言
![tcp_hello](/img/tcp_hello.webp)
![tcp_bye](/img/tcp_bye.webp)
![tcp_state](/img/tcp_state.webp)

### TIME_WAIT (2msl)
1. 正常完成四次挥手
2. 正常等待2msl后释放资源 (TCP机制)
3. 服务端能做的 (打铁还须自身硬)
- 文件描述符ulimit -Hn
- sysctl内核网络参数优化
4. 问题的根源在客户端为什么大量请求(短连接)又快速断开？
- 秒杀搞活动？ # 短连接 -> 长连接keepalive
- **CC攻击？** # 网关限流

### CLOSE_WAIT
1. 四次挥手未完成。
2. 客户端关闭连接之后服务器程序没有进一步发出ack信号。四次挥手腰斩。
3. 有可能就是客户端连接关闭之后，程序里没有检测到，或者程序压根就忘记了这个时候需要关闭连接，于是这个资源就一直被程序占着。 # 服务端程序bug。

### ref
https://www.jianshu.com/p/9968b16b607e