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
This repository collects Kubernetes manifests, Grafana dashboards, and Prometheus rules combined with documentation and scripts to provide easy to operate end-to-end Kubernetes cluster monitoring with Prometheus using the Prometheus Operator.

<!-- more -->

Components included in this package:
- The Prometheus Operator
- Highly available Prometheus
- Highly available Alertmanager
- Prometheus node-exporter
- Prometheus Adapter for Kubernetes Metrics APIs
- kube-state-metrics
- Grafana

The kube-prometheus stack includes a resource metrics API server, **so the metrics-server addon is not necessary.**

### 安装Prometheus
```bash
## https://github.com/opsnull/follow-me-install-kubernetes-cluster/blob/master/08-4.kube-prometheus%E6%8F%92%E4%BB%B6.md
## 
cd ~/k8s
git clone https://github.com/coreos/kube-prometheus.git
cd kube-prometheus
sed -i -e 's_quay.io_quay.mirrors.ustc.edu.cn_' manifests/*.yaml manifests/setup/*.yaml # quay.mirrors.ustc.edu.cn源

kubectl apply -f manifests/setup/
kubectl apply -f manifests/
```

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/altermanager_groupby.jpg?x-oss-process=style/blog-img-watermark)

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

### Ref
1. https://github.com/opsnull/follow-me-install-kubernetes-cluster/blob/master/08-4.kube-prometheus%E6%8F%92%E4%BB%B6.md
2. https://www.qikqiak.com/k8strain/monitor/operator/install/