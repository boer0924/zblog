---
title: Kubernetes镜像仓库Harbor
date: 2019-09-09 10:20:36
index_img: https://picsum.photos/300/200.webp?reg
tags:
  - Kubernetes
  - Docker
  - Registry
  - Harbor
categories: Kubernetes
---
在Kubernetes之上部署Harbor

Harbor is an open source registry that secures artifacts with policies and role-based access control, ensures images are scanned and free from vulnerabilities, and signs images as trusted. Harbor, a CNCF Graduated project, delivers compliance, performance, and interoperability to help you consistently and securely manage artifacts across cloud native compute platforms like Kubernetes and Docker.

> 在企业级Registry的行列，竟然没有Harbor的竞品...

<!-- more -->

### Helm Charts
```bash
~/k8s/charts
helm repo add harbor https://helm.goharbor.io
helm list
helm install --name harbor -f values.yaml . --namespace harbor
helm upgrade -f values.yaml harbor . --namespace harbor
helm delete --purge harbor
kubectl -n harbor delete pvc $(kubectl -n harbor get pvc | grep harbor | awk '{print $1}')
helm status harbor
helm fetch harbor/harbor --version 1.3.2
tar -zxf harbor-1.3.2.tgz
```

### Harbor Helm Values配置
```yaml
# vim harbor/values.yaml
expose:
  type: ingress
  tls:
    enabled: true
  ingress:
    hosts:
      core: registry.boer.xyz
      notary: notary.boer.xyz
    controller: default
    annotations:
      kubernetes.io/ingress.class: "nginx"
      ingress.kubernetes.io/ssl-redirect: "true"
      ingress.kubernetes.io/proxy-body-size: "0"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/proxy-body-size: "0"
externalURL: https://registry.boer.xyz
persistence:
  enabled: true
  resourcePolicy: "keep"
  persistentVolumeClaim:
    registry:
      storageClass: "openebs-hostpath"
    chartmuseum:
      storageClass: "openebs-hostpath"
    jobservice:
      storageClass: "openebs-hostpath"
    database:
      storageClass: "openebs-hostpath"
    redis:
      storageClass: "openebs-hostpath"
harborAdminPassword: "<your-secret-password>" # 注意替换
```

### Registry证书分发
```bash
kubectl -n harbor get secret harbor-harbor-ingress -o yaml
# 其中 data 区域中 ca.crt 对应的值就是我们需要证书，不过需要注意还需要做一个base64的解码
# 保存data区域ca.crt的base64 -d内容到harbor.crt

## docker私有registry -  证书分发
mkdir -p /etc/docker/certs.d/registry.boer.xyz
cp harbor.crt /etc/docker/certs.d/registry.boer.xyz # 所有master\node均需配置

## 本地浏览器 - 证书分发
# 下载harbor.crt到本地电脑，双击-导入浏览器，添加到信任的根证书目录
# Chrome会提示: 连接时安全的。
# ~灼眼的小红锁变成了可爱的小绿锁~
```

### Registry域名
> 如果你的环境没有自己的DNS服务器
```bash
# ansible下发harbor解析hosts
## 添加hosts
ansible k8s -m lineinfile -a "dest=/etc/hosts line='10.10.253.17 registry.boer.xyz'"
## 删除hosts
ansible k8s -m lineinfile -a "dest=/etc/hosts line='10.10.253.17 registry.boer.xyz' state=absent"
```

### 创建Registry secret
> 思路分享：Harbor建一个账号(比如: deployer)，作为K8S的公用镜像拉取账号。
> 注意将公用账户加入**每一个项目**的成员，并赋予**项目管理员**以上权限。
```bash
kubectl create secret docker-registry regcred --docker-server=registry.boer.xyz --docker-username=deployer --docker-password=<your-password> --docker-email=boer0924@gmail.com --namespace=boer-public
```

### 用法Demo
```yaml
## docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]
# docker tag boer0924/theapp:0.0.1 registry.boer.xyz/public/theapp:0.0.1
# docker push registry.boer.xyz/public/theapp:0.0.1 # 上传镜像
apiVersion: apps/v1
kind: Deployment
template:
  spec:
    containers:
    - name: theapp
      image: registry.boer.xyz/public/theapp:0.0.1
      imagePullPolicy: Always
      ports:
      - containerPort: 5000
    imagePullSecrets: # 划重点
    - name: regcred
```

### Ref
- https://www.qikqiak.com/post/harbor-quick-install/