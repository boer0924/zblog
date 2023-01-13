---
title: Kubernetes APM链路追踪Skywalking
date: 2020-08-16 10:16:18
index_img: https://picsum.photos/300/200.webp?sw
tags:
  - Kubernetes
  - Skywalking
  - Pinpoint
  - APM
  - Elasticsearch
categories: Kubernetes
---
随着RPC框架、微服务、云计算、大数据的发展，业务的规模和深度相比过往也都在增加。一个业务可能横跨多个模块/服务/容器，依赖的中间件也越来越多，其中任何一个节点出现异常，都可能导致业务出现波动或者异常，这就导致服务质量监控和异常诊断/定位变得异常复杂。于是催生了新的业务监控模式：调用链跟踪系统APM

<!-- more -->

在诸多优秀的开源APM产品中`Skywalking`和`Pinpoint`脱颖而出，两款产品都通过字节码注入的方式，实现了对代码完全无任何侵入。对比如下：
![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200828170623.png?x-oss-process=style/blog-img-watermark)

> 前面我们介绍过[单纯Docker方式(`docker-compose`)部署Pinpoint](/2019/05/09/pinpoint-deployment/), 可以提供参考。本节我们介绍在Kubernetes上部署Skywalking。

### 1、Helm3
```bash
curl -LO https://get.helm.sh/helm-v3.2.4-linux-amd64.tar.gz
tar -zxf helm-v3.2.4-linux-amd64.tar.gz
cp linux-amd64/helm /usr/local/bin/helm3
```

### 2、服务端
> Skywalking后端存储，使用EFK日志系统的ES集群。注意index加前缀区分
详细的Elasticsearch集群部署可以参考：[Kubernetes日志系统EFK](/2019/10/24/k8s-logging-efk/)

```bash
cd ~/k8s/helm/charts
git clone https://github.com/apache/skywalking-kubernetes.git
cd skywalking-kubernetes/chart
helm dep up skywalking
# 创建namespace
kubectl create ns skywalking
# 准备values文件, 详见Values
vim skywalking/values.yaml
#
helm3 install skywalking skywalking -n skywalking --values ./skywalking/values.yaml
helm3 -n skywalking list
helm3 -n skywalking delete skywalking
helm3 -n skywalking upgrade skywalking --values ./skywalking/values.yaml
```
#### Helm Values
```yaml
oap:
  name: oap
  dynamicConfigEnabled: false
  image:
    repository: apache/skywalking-oap-server
    tag: 8.1.0-es7
    pullPolicy: IfNotPresent
  storageType: elasticsearch7 # 存储类型es7
  ports:
    grpc: 11800
    rest: 12800
  replicas: 2
  service:
    type: ClusterIP
  javaOpts: -Xmx2g -Xms2g
  antiAffinity: "soft"
  nodeAffinity: {}
  nodeSelector: {}
  tolerations: []
  resources: {}
  env:
    SW_NAMESPACE: "skywalking" # es索引前缀skywalking_, _下划线会自动加上
ui:
  name: ui
  replicas: 1
  image:
    repository: apache/skywalking-ui
    tag: 8.1.0
    pullPolicy: IfNotPresent
  ingress:
    enabled: true
    annotations: {}
    path: /
    hosts:
      - skywalking.boer.xyz # ingress地址
    tls: []
elasticsearch:
  enabled: false # 关闭内置es，我们使用EFK日志系统的ES集群
  config:
    port:
      http: 9200
    host: "elasticsearch-logging.logging.svc" # 日志系统ES地址
    user: "elastic" 
    password: "<your-es-password>" 
```

### 3、客户端
#### 制作skywalking-agent镜像
```bash
cd ~/k8s/apps/skywalking-agent
tar -zxf apache-skywalking-apm-es7-8.1.0.tar.gz
cp apache-skywalking-apm-bin-es7/agent agent
vim Dockerfile # 准备Dockerfile, 详见Dockerfile
docker build -t registry.boer.xyz/public/skywalking-agent:8.1.0 .
docker push registry.boer.xyz/public/skywalking-agent:8.1.0
```
#### Dockerfile
```Dockerfile
FROM busybox:latest
ENV LANG=C.UTF-8
WORKDIR /usr/skywalking/agent
COPY agent/ .
```
#### skywalking-agent配置
```bash
# vim agent/config
agent.service_name=${SW_AGENT_NAME:Your_ApplicationName} # 服务名：区分不同服务，通过环境变量设置
agent.instance_name=${HOSTNAME} # 实例名：区分多实例，取Pod主机名
collector.backend_service=${SW_AGENT_COLLECTOR_BACKEND_SERVICES:skywalking-oap.skywalking.svc:11800} # 服务端地址
logging.file_name=${SW_LOGGING_FILE_NAME:skywalking-api.log}
logging.level=${SW_LOGGING_LEVEL:INFO}
logging.max_file_size=${SW_LOGGING_MAX_FILE_SIZE:31457280}
```

### 4、使用示例
使用`skywalking-agent`一般会想到两种方法：
- 将 agent 包构建到已经存在的基础镜像中
- 通过`initContainer`方式拷贝Agent

initContainer方式将`skywalking-agent`拷贝到应用Pod中，无需修改基础JVM镜像，所以更推荐此方法：
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: produce-deployment
  annotations:
    kubernetes.io/change-cause: <CHANGE_CAUSE>
spec:
  selector:
    matchLabels:
      app: produce
  replicas: 2
  template:
    metadata:
      labels:
        app: produce
    spec:
      initContainers:
        - image: registry.boer.xyz/public/skywalking-agent:8.1.0
          name: skywalking-agent
          imagePullPolicy: IfNotPresent
          command: ['sh']
          args: ['-c','cp -r /usr/skywalking/agent/* /skywalking/agent']
          volumeMounts:
            - mountPath: /skywalking/agent
              name: skywalking-agent
      containers:
        - name: produce
          image: <IMAGE>:<IMAGE_TAG>
          imagePullPolicy: IfNotPresent
          volumeMounts:
            - mountPath: /usr/skywalking/agent
              name: skywalking-agent
          ports:
            - containerPort: 10080
          resources:
            requests:
              memory: "512Mi"
              cpu: "200m"
            limits:
              memory: "1Gi"
              cpu: "600m"
          env:
            - name: ENVIRONMENT
              value: "pro"
            - name: SW_AGENT_NAME # sw服务名
              value: "springboot-produce"
            - name: JVM_OPTS
              value: "-Xms512m -Xmx512m -javaagent:/usr/skywalking/agent/skywalking-agent.jar"
          livenessProbe:
            httpGet:
              path: /actuator/health
              port: 10080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /actuator/health
              port: 10080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          lifecycle:
            preStop:
              exec:
                command:
                  - "curl"
                  - "-XPOST"
                  - "http://127.0.0.1:10080/actuator/shutdown"
      imagePullSecrets:
        - name: regcred
      volumes:
        - name: skywalking-agent
          emptyDir: {}
```

### 5、Skywalking ES存储索引管理
> 详细[**iLM索引生命周期**](/2019/10/24/k8s-logging-efk/#iLM管理索引生命周期)，见Kubernetes日志系统EFK一文

```json
PUT _ilm/policy/skywalking-policy   
{
  "policy": {                       
    "phases": {
      "warm": {
        "min_age": "2d",
        "actions": {
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "delete": {
        "min_age": "3d",           
        "actions": {
          "delete": {}              
        }
      }
    }
  }
}

PUT _template/skywalking-template
{
  "index_patterns": ["skywalking_*"], // 这里完全匹配skywalking索引前缀，即SW_NAMESPACE
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 0,
    "index.lifecycle.name": "skywalking-policy",
    "index.refresh_interval": "30s",
    "index.translog.durability": "async",
    "index.translog.sync_interval":"60s"
  }
}
```

### 6、The show
![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200828182335.png?x-oss-process=style/blog-img-watermark)
![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200828182157.png?x-oss-process=style/blog-img-watermark)

### Ref
- https://github.com/apache/skywalking-kubernetes
- https://skywalking.apache.org/zh/blog/2019-08-30-how-to-use-Skywalking-Agent.html
- https://skywalking.apache.org/zh/blog/2019-02-24-skywalking-pk-pinpoint.html
- https://skywalking.apache.org/zh/blog/2019-11-07-skywalking-elasticsearch-storage-optimization.html