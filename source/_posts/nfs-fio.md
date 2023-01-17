---
title: NFS CSI部署及Fio性能测试
date: 2022-09-09 16:10:18
index_img: https://picsum.photos/300/200.webp?nfs
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - fio
  - nfs
  - csi
categories: SRE
---
兼容NFS v3版本的NFS Server部署以及`nfs-subdir-external-provisioner`CSI安装配置，并通过Fio测试NFS性能。

<!-- more -->

# 兼容NFS v3版本的NFS Server
```bash
docker run --privileged -d --name nfs \
  --network kind \
  -v /home/boer/projects/kind-k8s/nfs_data:/data                        \
  -e NFS_EXPORT_0='/data *(rw,insecure,no_subtree_check,no_root_squash,fsid=1)'  \
  -p 2049:2049   -p 2049:2049/udp   \
  -p 111:111     -p 111:111/udp     \
  -p 32765:32765 -p 32765:32765/udp \
  -p 32767:32767 -p 32767:32767/udp \
  erichough/nfs-server:latest
# nfs csi
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/
helm install nfs-subdir-external-provisioner nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  --set nfs.server=172.30.254.86 \
  --set nfs.path=/data
# Storage Class
nfs-client Delete archiveOnDelete=true
nfs Retain archiveOnDelete=true
# test
https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner/tree/master/deploy

helm install -n operators nfs-subdir-external-provisioner --set nfs.server=repository.boer.xyz --set nfs.path=/nfs --set storageClass.name=nfs-storage .
```

# PVC FIO

[1、参考：测试块存储性能](https://help.aliyun.com/document_detail/147897.html)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fio-test-cm
  namespace: default
data:
  default-fio: |
    [global]
    randrepeat=0
    verify=0
    ioengine=libaio
    direct=1
    gtod_reduce=1
    [job1]
    name=read_iops
    bs=4K
    iodepth=64
    size=2G
    readwrite=randread
    time_based
    ramp_time=2s
    runtime=15s
    [job2]
    name=write_iops
    bs=4K
    iodepth=64
    size=2G
    readwrite=randwrite
    time_based
    ramp_time=2s
    runtime=15s
    [job3]
    name=read_bw
    bs=128K
    iodepth=64
    size=2G
    readwrite=randread
    time_based
    ramp_time=2s
    runtime=15s
    [job4]
    name=write_bw
    bs=128k
    iodepth=64
    size=2G
    readwrite=randwrite
    time_based
    ramp_time=2s
    runtime=15s
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fio-test-pvc
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard
---
apiVersion: v1
kind: Pod
metadata:
  name: fio-test-pod
  namespace: default
spec:
  containers:
  - name: fio
    command:
      - /bin/sh
    args:
      - -c
      - tail -f /dev/null
    image: xridge/fio:latest
    imagePullPolicy: Always
    volumeMounts:
    - mountPath: /data
      name: persistent-storage
    - mountPath: /etc/fio-config
      name: config-map
  volumes:
  - name: persistent-storage
    persistentVolumeClaim:
      claimName: fio-test-pvc
  - name: config-map
    configMap:
      name: fio-test-cm

fio /etc/fio-config/default-fio
fio --directory /data /etc/fio-config/default-fio --output-format normal

fio -direct=1 -iodepth=128 -rw=randread -ioengine=libaio -bs=128k -numjobs=1 -time_based=1 -runtime=1000 -group_reporting -filename=/data/rr128k -size=2G -name=rr128k

fio -direct=1 -iodepth=128 -rw=randwrite -ioengine=libaio -bs=128k -numjobs=1 -time_based=1 -runtime=1000 -group_reporting -filename=/data/rw128k -size=2G -name=rw128k
```

[2、参考：fio](https://fio.readthedocs.io/en/latest/fio_doc.html#i-o-type)

# Docker方式

```bash
docker run --rm -v $(pwd)/test:/data -v /tmp/jobs.fio:/tmp/jobs.fio harbor.boer.xyz/public/xridge_fio:latest /tmp/jobs.fio
```