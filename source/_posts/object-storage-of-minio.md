---
title: 对象存储MinIO实践
date: 2021-09-01 15:56:18
index_img: https://picsum.photos/300/200.webp?minio
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - MinIO
  - OSS
categories: DevOps
---
https://min.io/

<!-- more -->

### install minio
```
useradd -M -d /opt/minio -s /sbin/nologin -c "MinIO User" minio
mkdir /opt/minio/{bin,data/{drive1,drive2},certs}
curl -sL https://dl.min.io/server/minio/release/linux-amd64/minio -o /opt/minio/bin/minio
chown -R minio. /opt/minio
chmod a+x /opt/minio/bin/minio
```

### /etc/default/minio
```conf
# Volume to be used for MinIO server.
MINIO_VOLUMES="http://10.10.253.16:19000/opt/minio/data/drive1 http://10.10.253.16:19000/opt/minio/data/drive2 http://10.10.253.17:19000/opt/minio/data/drive1 http://10.10.253.17:19000/opt/minio/data/drive2 http://10.10.253.18:19000/opt/minio/data/drive1 http://10.10.253.18:19000/opt/minio/data/drive2"
### Please provide an even number of endpoints greater or equal to 4
# Use if you want to run MinIO on a custom port.
MINIO_OPTS="--address :19000 --console-address :19001"
# Root user for the server.
MINIO_ROOT_USER=admin
# Root secret for the server.
MINIO_ROOT_PASSWORD=passw0rd
```

### /etc/systemd/system
```conf
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/opt/minio/bin/minio

[Service]
WorkingDirectory=/opt/minio

User=minio
Group=minio

EnvironmentFile=-/etc/default/minio
ExecStartPre=/bin/bash -c "if [ -z \"${MINIO_VOLUMES}\" ]; then echo \"Variable MINIO_VOLUMES not set in /etc/default/minio\"; exit 1; fi"
ExecStart=/opt/minio/bin/minio server $MINIO_OPTS $MINIO_VOLUMES

# Let systemd restart this service always
Restart=always

# Specifies the maximum file descriptor number that can be opened by this process
LimitNOFILE=65536

# Specifies the maximum number of threads this process can create
TasksMax=infinity

# Disable timeout logic and wait until process is stopped
TimeoutStopSec=infinity
SendSIGKILL=no

[Install]
WantedBy=multi-user.target

# Built for ${project.name}-${project.version} (${project.name})
```

### MinIO Ops
`systemctl start minio.service`
`journalctl -fu minio.service`

### Ref
- https://github.com/minio/minio-service/tree/master/linux-systemd