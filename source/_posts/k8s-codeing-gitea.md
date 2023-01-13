---
title: Kubernetes部署代码仓库Gitea
date: 2020-04-24 10:16:18
index_img: https://picsum.photos/300/200.webp?gitea
tags:
  - Devops
  - Gogs
  - Gitea
  - Gitlab
categories: Kubernetes
---
Gitea 是一个开源社区驱动的**轻量级**代码托管解决方案
> https://docs.gitea.io/zh-cn/comparison/

- 支持活动时间线
- 支持 SSH 以及 HTTP/HTTPS 协议
- 支持 SMTP、LDAP 和反向代理的用户认证
- 支持反向代理子路径
- 支持用户、组织和仓库管理系统
- 支持添加和删除仓库协作者
- 支持仓库和组织级别 Web 钩子（包括 Slack 集成）
- 支持仓库 Git 钩子和部署密钥
- 支持仓库工单（Issue）、合并请求（Pull Request）以及 Wiki
- 支持迁移和镜像仓库以及它的 Wiki
- 支持在线编辑仓库文件和 Wiki
- 支持自定义源的 Gravatar 和 Federated Avatar
- 支持邮件服务
- 支持后台管理面板
- 支持 MySQL、PostgreSQL、SQLite3, MSSQL 和 TiDB（实验性支持） 数据库
- 支持多语言本地化（21 种语言）

<!-- more -->

### Database
#### Fetch MySQL Helm Charts
```bash
helm repo add stable https://mirror.azure.cn/kubernetes/charts
helm repo add incubator https://mirror.azure.cn/kubernetes/charts-incubator
cd ~/k8s/helm/charts
helm search mysql --version 1.6.4
helm fetch stable/mysql --version 1.6.4
tar -zxf mysql-1.6.4.tgz
cd mysql
# modify values.yaml 详见下文
helm install --name mysql -f values.yaml . --namespace devops
helm upgrade -f values.yaml mysql . --namespace devops
helm delete --purge mysql # It's Dangerous
```
#### MySQL Helm values.yaml
划重点
1. 创建gitea库、用户、密码
2. openebs动态持久卷storageClass
3. 设置默认字符集initializationFiles
4. metallb service服务暴露
```yaml
image: "mysql"
imageTag: "5.7.30"
strategy:
  type: Recreate
mysqlRootPassword: Root@123
mysqlUser: gitea
mysqlPassword: Gitea@123
mysqlDatabase: gitea
imagePullPolicy: IfNotPresent
persistence:
  enabled: true
  ## database data Persistent Volume Storage Class
  ## If defined, storageClassName: <storageClass>
  ## If set to "-", storageClassName: "", which disables dynamic provisioning
  ## If undefined (the default) or set to null, no storageClassName spec is
  ##   set, choosing the default provisioner.  (gp2 on AWS, standard on
  ##   GKE, AWS & OpenStack)
  ##
  # storageClass: "-"
  storageClass: "openebs-hostpath"
  accessMode: ReadWriteOnce
  size: 10Gi
  annotations: {}
securityContext:
  enabled: false
  runAsUser: 999
  fsGroup: 999
resources:
  requests:
    memory: 256Mi
    cpu: 100m
configurationFilesPath: /etc/mysql/conf.d/
configurationFiles: {}
initializationFiles:
  first-db.sql: |-
    CREATE DATABASE IF NOT EXISTS first DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_general_ci;
metrics:
  enabled: false
  image: prom/mysqld-exporter
  imageTag: v0.10.0
  imagePullPolicy: IfNotPresent
  resources: {}
  annotations: {}
    # prometheus.io/scrape: "true"
    # prometheus.io/port: "9104"
  livenessProbe:
    initialDelaySeconds: 15
    timeoutSeconds: 5
  readinessProbe:
    initialDelaySeconds: 5
    timeoutSeconds: 1
  flags: []
  serviceMonitor:
    enabled: false
    additionalLabels: {}
service:
  # annotations: {}
  annotations:
    metallb.universe.tf/address-pool: default
  ## Specify a service type
  ## ref: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services---service-types
  type: LoadBalancer
  port: 3306
  # nodePort: 32000
  # loadBalancerIP:
```

### Gitea
划重点
1. openebs动态持久卷storageClass
2. metallb service暴露ssh端口
3. ingress service暴露http端口
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  namespace: devops
  name: gitea-deployment
  labels:
    app: gitea
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gitea
  template:
    metadata:
      labels:
        app: gitea
    spec:
      containers:
      - name: gitea
        image: gitea/gitea:1.12.2
        ports:
        - containerPort: 3000
          name: gitea-http
        - containerPort: 22
          name: gitea-ssh
        volumeMounts:
        - mountPath: /data
          name: gitea-data
      volumes:
      - name: gitea-data
        persistentVolumeClaim:
          claimName: gitea-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: gitea-pvc
  namespace: devops
spec:
  storageClassName: openebs-hostpath
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
---
kind: Service
apiVersion: v1
metadata:
  name: gitea-service
  namespace: devops
  annotations:
    metallb.universe.tf/address-pool: default
spec:
  selector:
    app: gitea
  type: LoadBalancer
  ports:
  - name: gitea-http
    port: 3000
    targetPort: gitea-http
  - name: gitea-ssh
    port: 22
    targetPort: gitea-ssh
---
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: gitea-ingress
  namespace: devops
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/load-balance: "ip_hash"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri"
spec:
  rules:
  - host: gitea.boer.xyz
    http:
      paths:
      - path: /
        backend:
          serviceName: gitea-service
          servicePort: 3000
```

### Gitea按照引导
![gitea_installer](/img/gitea_installer.png)
- 数据库类型：MySQL
- 数据库主机：mysql service-name:3306
- 用户/密码/数据库： gitea
- http域名：gitea.boer.xyz (ingress域名)
- ssh通过域名：gitea.boer.xyz (与ingress域名一致)
- 最下面创建管理员账号（如果未创建，则第一个注册账号为管理员）

---

> 添加SSHKey，开始使用吧！