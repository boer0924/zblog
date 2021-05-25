---
title: 主机初始化的那些事儿
date: 2018-03-24 16:30:18
index_img: https://picsum.photos/300/200.webp?initialize
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - parted
  - kernel
categories: DevOps
---
集群中加入一个主机后，需要做的那些事儿

<!-- more -->

### 磁盘挂载
```bash
parted /dev/vdb mklabel gpt mkpart 1 xfs 1 100%
mkfs.xfs /dev/vdb1
mkdir /new_disk
echo "UUID=`blkid /dev/vdb1 | awk -F'"' '{print $2}'` /new_disk xfs defaults 1 1" >> /etc/fstab
mount -a
df -h
```

### 内核优化
```bash
# 内核参数优化
vim /etc/sysctl.conf
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_tw_recycle = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_tw_buckets = 8000
# fs.file-max = 102400000
vm.max_map_count = 262144
vm.swappiness = 10
sysctl –p  # 配置生效

# 文件描述符限制
vim /etc/security/limits.conf
* soft nofile 102400
* hard nofile 204800
ulimit -Sn
ulimit -Hn

# nproc
## nproc是操作系统级别对每个用户创建的进程数的限制, 在Linux下运行多线程时, 每个线程的实现其实是一个轻量级的进程, 对应的术语是light weight process(LWP)。
# 查看所有用户创建的进程数,使用命令：
ps h -Led -o user | sort | uniq -c | sort -n
# 查看boer用户创建的进程数，使用命令:
ps -o nlwp,pid,lwp,args -u boer | sort -n

vim /etc/security/limits.d/20-nproc.conf # CentOS7
*          soft    nproc     65536
root       soft    nproc     unlimited

##
```

### 监控、日志Agent
- filebeat
- zabbix/node_exporter