---
title: Kubernetes监控系统Prometheus
date: 2019-10-10 10:16:18
index_img: https://picsum.photos/300/200.webp?prometheus
tags:
  - Prometheus
  - Monitoring
  - Operator
  - CRD
categories: Kubernetes
---
Prometheus : Monitoring & TSDB
Alertmanager : 告警中心
node-exporter : 宿主机Node基础监控
metrics-server (heapster) : 集群资源监控/HPA
kube-state-metrics : K8S资源监控
Grafana : 用户UI展示

<!-- more -->
### Prometheus Operator

The Operator acts on the following custom resource definitions (CRDs):
- **Prometheus**, which defines a desired Prometheus deployment. # 定义Prometheus集群
- **Alertmanager**, which defines a desired Alertmanager deployment. # 定义Alertmanager集群
- **ThanosRuler**, which defines a desired Thanos Ruler deployment.
- **ServiceMonitor**, which declaratively specifies how groups of Kubernetes services should be monitored. The Operator automatically generates Prometheus scrape configuration based on the current state of the objects in the API server. # 定义监控项
- **PodMonitor**, which declaratively specifies how group of pods should be monitored. The Operator automatically generates Prometheus scrape configuration based on the current state of the objects in the API server.
- **Probe**, which declaratively specifies how groups of ingresses or static targets should be monitored. The Operator automatically generates Prometheus scrape configuration based on the definition.
- **PrometheusRule**, which defines a desired set of Prometheus alerting and/or recording rules. The Operator generates a rule file, which can be used by Prometheus instances. # 定义告警策略

[Prometheus Operator vs. kube-prometheus vs. community helm chart](https://github.com/prometheus-operator/prometheus-operator#prometheus-operator-vs-kube-prometheus-vs-community-helm-chart)

### kube-prometheus
Components included in this package:
- The Prometheus Operator
- Highly available Prometheus
- Highly available Alertmanager
- Prometheus node-exporter
- Prometheus Adapter for Kubernetes Metrics APIs
- kube-state-metrics
- Grafana

The kube-prometheus stack includes a resource metrics API server, **so the metrics-server addon is not necessary.**

### kube-prometheus方式部署监控方案
```bash
## https://github.com/opsnull/follow-me-install-kubernetes-cluster/blob/master/08-4.kube-prometheus%E6%8F%92%E4%BB%B6.md
## 
cd ~/k8s
git clone https://github.com/coreos/kube-prometheus.git
cd kube-prometheus
sed -i -e 's_quay.io_quay.mirrors.ustc.edu.cn_' manifests/*.yaml manifests/setup/*.yaml # quay.mirrors.ustc.edu.cn源

kubectl apply -f manifests/setup/ # 先部署Prometheus Operator
kubectl apply -f manifests/ # 再部署Prometheus, Alertmanager等各种CRD资源
```

### 暴露Ingress
```yaml
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: monitoring
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/load-balance: "ip_hash"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri"
spec:
  rules:
  - host: monitoring.boer.xyz
    http:
      paths:
      - path: /
        backend:
          serviceName: grafana
          servicePort: 3000
  - host: prometheus.boer.xyz
    http:
      paths:
      - path: /
        # pathType: Prefix
        backend:
          serviceName: prometheus-k8s
          servicePort: 9090
  - host: alertmanager.boer.xyz
    http:
      paths:
      - path: /
        backend:
          serviceName: alertmanager-main
          servicePort: 9093
```

### kube-prometheus自定义配置
`cd ~/k8s/kube-prometheus`

#### Grafana 数据持久化
```yaml
# vim manifests/grafana-deployment.yaml
      volumes:
      # - emptyDir: {}
      #   name: grafana-storage
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-storage-k8s
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  labels:
    app: grafana
    grafana: k8s
  name: grafana-storage-k8s
  namespace: monitoring
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  storageClassName: openebs-hostpath
```

#### Prometheus自定义配置
```yaml
# vim manifests/prometheus-prometheus.yaml
  retention: 72h # 数据保存时长
  externalUrl: http://prometheus.boer.xyz # 对应Ingress地址
  additionalScrapeConfigs:
    name: additional-scrape-configs # 自动发现监控<详见下文>
    key: prometheus-additional.yaml
  storage: # 数据持久化
    volumeClaimTemplate:
      spec:
        storageClassName: openebs-hostpath
        resources:
          requests:
            storage: 5Gi
```

#### Alertmanager自定义配置
```yaml
# vim manifests/alertmanager-alertmanager.yaml
apiVersion: monitoring.coreos.com/v1
kind: Alertmanager
metadata:
  labels:
    alertmanager: main
  name: main
  namespace: monitoring
spec:
  image: quay.mirrors.ustc.edu.cn/prometheus/alertmanager:v0.20.0
  nodeSelector:
    kubernetes.io/os: linux
  replicas: 1
  securityContext:
    fsGroup: 2000
    runAsNonRoot: true
    runAsUser: 1000
  serviceAccountName: alertmanager-main
  version: v0.20.0
  externalUrl: http://alertmanager.boer.xyz # 对应Ingress地址
```

### Alertmanager企业微信告警
```yaml
# vim alertmanager-main-secrets.yaml
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: alertmanager-main
  namespace: monitoring
data: {}
stringData:
  alertmanager.yaml: |-
    "global":
      "resolve_timeout": "5m"
    "inhibit_rules":
    - "equal":
      - "namespace"
      - "alertname"
      "source_match":
        "severity": "critical"
      "target_match_re":
        "severity": "warning|info"
    - "equal":
      - "namespace"
      - "alertname"
      "source_match":
        "severity": "warning"
      "target_match_re":
        "severity": "info"
    "receivers":
    - "name": "Default"
      "wechat_configs": # 企业微信接收告警信息 https://work.weixin.qq.com/api/doc/90000/90135/90236#%E6%96%87%E6%9C%AC%E6%B6%88%E6%81%AF
      - "corp_id": "<corp_id>"
        "to_user": "<user1|user2>"
        "agent_id": "<1000007>"
        "api_secret": "<api_secret>"
    - "name": "Watchdog"
    - "name": "Critical"
    "route":
      "group_by":
      - "alertname" # 按alertname分组告警
      "group_interval": "5m"
      "group_wait": "30s"
      "receiver": "Default"
      "repeat_interval": "12h" # 重复告警间隔时间
      "routes":
      - "match":
          "alertname": "Watchdog"
        "receiver": "Default"
      - "match":
          "severity": "critical"
        "receiver": "Default"
# 强制应用配置
kubectl delete -f alertmanager-main-secrets.yaml
kubectl apply -f alertmanager-main-secrets.yaml
```

### 自动发现监控配置
>https://github.com/prometheus-operator/prometheus-operator/blob/master/Documentation/additional-scrape-config.md

```yaml
# vim prometheus-additional.yaml
- job_name: 'kubernetes-endpoints'
  kubernetes_sd_configs:
  - role: endpoints
  relabel_configs:
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
    action: keep
    regex: true
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scheme]
    action: replace
    target_label: __scheme__
    regex: (https?)
  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
    action: replace
    target_label: __metrics_path__
    regex: (.+)
  - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
    action: replace
    target_label: __address__
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)
  - source_labels: [__meta_kubernetes_namespace]
    action: replace
    target_label: kubernetes_namespace
  - source_labels: [__meta_kubernetes_service_name]
    action: replace
    target_label: kubernetes_name
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: kubernetes_pod_name
---
# vim additional-scrape-configs.yaml
apiVersion: v1
kind: Secret
metadata:
  name: additional-scrape-configs
  namespace: monitoring
data:
  prometheus-additional.yaml: LSBqb2JfbmFtZTogJ2t1YmVybmV0ZXMtZW5kcG9pbnRzJwogIGt1YmVybmV0ZXNfc2RfY29uZmlnczoKICAtIHJvbGU6IGVuZHBvaW50cwogIHJlbGFiZWxfY29uZmlnczoKICAtIHNvdXJjZV9sYWJlbHM6IFtfX21ldGFfa3ViZXJuZXRlc19zZXJ2aWNlX2Fubm90YXRpb25fcHJvbWV0aGV1c19pb19zY3JhcGVdCiAgICBhY3Rpb246IGtlZXAKICAgIHJlZ2V4OiB0cnVlCiAgLSBzb3VyY2VfbGFiZWxzOiBbX19tZXRhX2t1YmVybmV0ZXNfc2VydmljZV9hbm5vdGF0aW9uX3Byb21ldGhldXNfaW9fc2NoZW1lXQogICAgYWN0aW9uOiByZXBsYWNlCiAgICB0YXJnZXRfbGFiZWw6IF9fc2NoZW1lX18KICAgIHJlZ2V4OiAoaHR0cHM/KQogIC0gc291cmNlX2xhYmVsczogW19fbWV0YV9rdWJlcm5ldGVzX3NlcnZpY2VfYW5ub3RhdGlvbl9wcm9tZXRoZXVzX2lvX3BhdGhdCiAgICBhY3Rpb246IHJlcGxhY2UKICAgIHRhcmdldF9sYWJlbDogX19tZXRyaWNzX3BhdGhfXwogICAgcmVnZXg6ICguKykKICAtIHNvdXJjZV9sYWJlbHM6IFtfX2FkZHJlc3NfXywgX19tZXRhX2t1YmVybmV0ZXNfc2VydmljZV9hbm5vdGF0aW9uX3Byb21ldGhldXNfaW9fcG9ydF0KICAgIGFjdGlvbjogcmVwbGFjZQogICAgdGFyZ2V0X2xhYmVsOiBfX2FkZHJlc3NfXwogICAgcmVnZXg6IChbXjpdKykoPzo6XGQrKT87KFxkKykKICAgIHJlcGxhY2VtZW50OiAkMTokMgogIC0gYWN0aW9uOiBsYWJlbG1hcAogICAgcmVnZXg6IF9fbWV0YV9rdWJlcm5ldGVzX3NlcnZpY2VfbGFiZWxfKC4rKQogIC0gc291cmNlX2xhYmVsczogW19fbWV0YV9rdWJlcm5ldGVzX25hbWVzcGFjZV0KICAgIGFjdGlvbjogcmVwbGFjZQogICAgdGFyZ2V0X2xhYmVsOiBrdWJlcm5ldGVzX25hbWVzcGFjZQogIC0gc291cmNlX2xhYmVsczogW19fbWV0YV9rdWJlcm5ldGVzX3NlcnZpY2VfbmFtZV0KICAgIGFjdGlvbjogcmVwbGFjZQogICAgdGFyZ2V0X2xhYmVsOiBrdWJlcm5ldGVzX25hbWUKICAtIHNvdXJjZV9sYWJlbHM6IFtfX21ldGFfa3ViZXJuZXRlc19wb2RfbmFtZV0KICAgIGFjdGlvbjogcmVwbGFjZQogICAgdGFyZ2V0X2xhYmVsOiBrdWJlcm5ldGVzX3BvZF9uYW1lCg==
---
# 注意manifests/prometheus-prometheus.yaml additionalScrapeConfigs配置项
---
# 需要自动发现监控的应用配置示例: (springboot)
prometheus.io/path: /actuator/prometheus
prometheus.io/port: '10080'
prometheus.io/scrape: 'true'
```

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200821152346.png?x-oss-process=style/blog-img-watermark)

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/altermanager_groupby.jpg?x-oss-process=style/blog-img-watermark)

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200821112157.png?x-oss-process=style/blog-img-watermark)

### Grafana插件
> https://grafana.com/grafana/plugins/devopsprodigy-kubegraf-app

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20200821154757.png?x-oss-process=style/blog-img-watermark)

### Ref
1. https://github.com/prometheus-operator/prometheus-operator
2. https://github.com/prometheus-operator/kube-prometheus
3. https://github.com/opsnull/follow-me-install-kubernetes-cluster/blob/master/08-4.kube-prometheus%E6%8F%92%E4%BB%B6.md
4. https://www.qikqiak.com/k8strain/monitor/operator/install/
5. https://work.weixin.qq.com/api/doc/90000/90135/90236#%E6%96%87%E6%9C%AC%E6%B6%88%E6%81%AF
6. https://github.com/prometheus-operator/prometheus-operator/blob/master/Documentation/additional-scrape-config.md