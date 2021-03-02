---
title: Kubernetes日志系统EFK
date: 2019-10-24 10:16:18
index_img: https://picsum.photos/300/200.webp?efk
tags:
  - logging
  - Kubernetes
  - Elasticsearch
  - Filebeat
  - Kibana
  - Fluentd
categories: Kubernetes
---
Elasticsearch + Filebeat + Kibana = EFK
F: it's not Fluentd
> Fluentd需要学习配置语法, Filebeat相对熟悉

https://github.com/elastic/helm-charts

<!-- more -->

### Requirements
- Helm >=2.8.0 and <3.0.0
- Kubernetes >=1.8
- 3 Work-node
- 1GB of RAM for the JVM heap

### Helm Charts
```bash
helm repo add elastic https://helm.elastic.co
helm repo update

cd ~/k8s/helm/charts

helm search elasticsearch --version 7.6.2
helm search filebeat --version 7.6.2
helm search kibana --version 7.6.2

helm fetch elastic/elasticsearch --version 7.6.2
helm fetch elastic/filebeat --version 7.6.2
helm fetch elastic/kibana --version 7.6.2

tar -zxf elasticsearch-7.6.2.tgz
tar -zxf filebeat-7.6.2.tgz
tar -zxf kibana-7.6.2.tgz

# 安装
helm install --name elasticsearch -f values.yaml . --namespace logging
helm install --name filebeat -f values.yaml . --namespace logging
helm install --name kibana -f values.yaml . --namespace logging
# 更新
helm upgrade -f values.yaml elasticsearch . --namespace logging
helm upgrade -f values.yaml filebeat . --namespace logging
helm upgrade -f values.yaml kibana . --namespace logging
# 删除
helm delete --purge elasticsearch
helm delete --purge filebeat
helm delete --purge kibana
# 删除es-pvc *仅测试
kubectl -n logging delete pvc -l app=elasticsearch-logging
```

### Elasticsearch
#### 创建CA证书
```bash
curl -LO https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-7.6.2-linux-x86_64.tar.gz
tar -zxf elasticsearch-7.6.2-linux-x86_64.tar.gz
cd elasticsearch-7.6.2
# 生成RootCA
bin/elasticsearch-certutil ca --days 36500 # elastic-stack-ca.p12
# 签发证书
bin/elasticsearch-certutil cert --ca elastic-stack-ca.p12 --days 36500 # elastic-certificates.p12

# 转换证书、验证有效期
openssl pkcs12 -in elastic-certificates.p12 -out elastic-certificates.pem -nodes
openssl x509 -in elastic-certificates.pem -noout -dates

# CA secret
kubectl -n logging create secret generic elastic-certificates --from-file=elastic-certificates.p12
# 挂载secret
## 详见下面values.yaml
secretMounts:
  - name: elastic-certificates
    secretName: elastic-certificates
    path: /usr/share/elasticsearch/config/certs
# 使用CA
## 详见下面values.yaml
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate 
xpack.security.transport.ssl.keystore.path: certs/elastic-certificates.p12 
xpack.security.transport.ssl.truststore.path: certs/elastic-certificates.p12
```
#### Elasticsearch Helm Values配置
```yaml
# vim values.yaml
clusterName: "elasticsearch"
nodeGroup: "logging"
# The service that non master groups will try to connect to when joining the cluster
# This should be set to clusterName + "-" + nodeGroup for your master group
masterService: "elasticsearch-logging"
esConfig:
  elasticsearch.yml: |
    xpack.security.enabled: true # 开启xpack.security, 所以需要下面ssl证书, 所以需要下面extraEnvs
    xpack.security.transport.ssl.enabled: true
    xpack.security.transport.ssl.verification_mode: certificate
    xpack.security.transport.ssl.keystore.path: certs/elastic-certificates.p12
    xpack.security.transport.ssl.truststore.path: certs/elastic-certificates.p12
    xpack.monitoring.enabled: true # 开启xpack.monitoring监控
    xpack.monitoring.collection.enabled: true
    xpack.monitoring.exporters.my_local: # 监控数据export当前集群。用自己监控自己, not最佳实践
      type: local
      use_ingest: false
extraEnvs: # 不安全。应该使用secrets存储密码 @TODO
  - name: ELASTIC_USERNAME
    value: "elastic"
  - name: ELASTIC_PASSWORD
    value: "123456"
secretMounts:
  - name: elastic-certificates
    secretName: elastic-certificates
    path: /usr/share/elasticsearch/config/certs
esJavaOpts: "-Xmx1g -Xms1g" # es heapsize
resources:
  requests:
    cpu: "1000m"
    memory: "2Gi"
  limits:
    cpu: "1000m"
    memory: "2Gi"
volumeClaimTemplate:
  accessModes: [ "ReadWriteOnce" ]
  storageClassName: "openebs-hostpath" # StorageClass # 建议LocalPV 性能好
  resources:
    requests:
      storage: 200Gi
clusterHealthCheckParams: "wait_for_status=green&timeout=3s" # readinessProbe
ingress: # 是否Ingress暴露
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
  path: /
  hosts:
    - elasticsearch.boer.xyz
```

### Filebeat
#### Filebeat Helm Values配置
```yaml
---
filebeatConfig:
  filebeat.yml: |
    filebeat.inputs:
    - type: docker
      containers.ids:
      - '*'
    processors:
      - add_kubernetes_metadata: ~
      - drop_fields: # drop掉不需要的字段
          fields: ["ecs", "log", "input", "agent"] # 缩进很重要
          ignore_missing: false
    
    setup.template.name: "kube-logging-template"
    setup.template.pattern: "kube-logging*"
    setup.ilm.enabled: false # fix输出到filebeat-<version> {now/d}-000001, BUG?

    output.elasticsearch:
      host: '${NODE_NAME}'
      hosts: '${ELASTICSEARCH_HOSTS:elasticsearch-logging:9200}' # es-svc:9200
      index: "kube-logging" # iLM管理的alias
      # index: "kube-logging-%{+yyyy.MM.dd}"
      username: "elastic"
      password: "123456"
```

### Kibana
#### Kibana Helm Values配置
```yaml
elasticsearchHosts: "http://elasticsearch-logging:9200"
extraEnvs:
  - name: "NODE_OPTIONS"
    value: "--max-old-space-size=1800"
  - name: ELASTICSEARCH_USERNAME
    value: "elastic"
  - name: ELASTICSEARCH_PASSWORD
    value: "123456"
healthCheckPath: "/app/kibana"
# healthCheckPath: "/api/status" # readinessProbe搞死你
kibanaConfig: # exec进pod发现默认配置文件错误
  kibana.yml: |
    elasticsearch:
      i18n.locale: "zh-CN"
      hosts: [ "http://elasticsearch-logging:9200" ]
      username: "elastic"
      password: "123456"
ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    # kubernetes.io/tls-acme: "true"
  path: /
  hosts:
    - logging.boer.xyz
  tls: []

```
#### Kibana Pod readinessProbe
```bash
http () {
    local path="${1}"
    set -- -XGET -s --fail

    if [ -n "${ELASTICSEARCH_USERNAME}" ] && [ -n "${ELASTICSEARCH_PASSWORD}" ]; then
    set -- "$@" -u "${ELASTICSEARCH_USERNAME}:${ELASTICSEARCH_PASSWORD}"
    fi

    STATUS=$(curl --output /dev/null --write-out "%{http_code}" -k "$@" "http://localhost:5601${path}")
    if [[ "${STATUS}" -eq 200 ]]; then
    exit 0
    fi

    echo "Error: Got HTTP code ${STATUS} but expected a 200"
    exit 1
}
# 解析后的命令
curl -XGET -s --fail --output /dev/null --write-out "%{http_code}" -k -u elastic:123456 http://localhost:5601/app/kibana
# exec进pod curl一下
# ready否，请10min再下结论 ***
```

### iLM管理索引生命周期
```bash
GET _cluster/health
GET _cat/indices
# iLM策略, 50gb/1d切割, 2d: forcemerge, 5d: freeze, 10d: 删除
PUT _ilm/policy/kube-logging-policy   
{
  "policy": {                       
    "phases": {
      "hot": {                      
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "1d"
            # "max_docs": 6000
          }
        }
      },
      "warm": {
        "min_age": "2d",
        "actions": {
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "cold": {
        "min_age": "5d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "10d",           
        "actions": {
          "delete": {}              
        }
      }
    }
  }
}
# 创建索引模板
PUT _template/kube-logging-template
{
  "index_patterns": ["kube-logging*"], 
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index.lifecycle.name": "kube-logging-policy", 
    "index.lifecycle.rollover_alias": "kube-logging",
    "index.refresh_interval": "30s",
    "index.translog.durability": "async",
    "index.translog.sync_interval":"30s"
  }
}
# 创建第一个关联索引
PUT %3Ckube-logging-%7Bnow%2Fd%7D-000001%3E
{
  "aliases": {
    "kube-logging": {}
  }
}

GET kube-logging-2020.07.09-000001/_search

# iLM生效时间
PUT _cluster/settings
{
  "persistent": {
    "indices.lifecycle.poll_interval": "30s"
  }
}
GET _ilm/status
POST _ilm/start
```

### ES进阶配置
```bash
# 单机多节点部署避免主副分片被分配到同一物理机
cluster.routing.allocation.same_shard.host: true
cluster.routing.allocation.awareness.attributes: box_type

index.routing.allocation.require.box_type: hot # 冷热分离
index.routing.allocation.total_shards_per_node: 1
```

### Filebeat配置
```yaml
filebeat.inputs:
- type: log
  paths: 
    - /home/apps/Logs/*.boer.xyz/*.log
  fields: {ip: ipv4address, log_type: apps}
  fields_under_root: true
  multiline.match: after
  multiline.negate: true
  multiline.pattern: ^[0-9]{4}-[0-9]{2}-[0-9]{2}
  tail_files: true
  symlinks: true

- type: log
  paths: [/home/apps/Logs/nginx/*.log]
  fields: {ip: ipv4address, log_type: elb}
  fields_under_root: true
  tail_files: true
  symlinks: true

- type: log
  paths: [/var/log/messages, /var/log/secure, /var/log/cron, /var/log/spooler, /var/log/audit/audit.log]
  fields: {ip: ipv4address, log_type: syslog}
  fields_under_root: true
  tail_files: true
  symlinks: true

- type: log
  paths: [/home/apps/Logs/*.boer.xyz/monitor/*.log]
  fields: {ip: ipv4address, log_type: monitor}
  fields_under_root: true
  tail_files: true 
  symlinks: true

- type: log
  paths:
    - "/home/apps/Logs/*.boer.xyz/audit/*.log"
  fields: {ip: ipv4address, log_type: audit}
  fields_under_root: true
  tail_files: true
  symlinks: true

processors:
- rename:
    fields:
     - from: "log.file.path"
       to: "source"
    ignore_missing: false
    fail_on_error: true
- drop_fields:
    fields: ["log","ecs","host","agent"] 
- drop_fields:
    when:
      equals:
        log_type: monitor
    fields: ["input_type","source"]    

output.kafka:
  hosts: ["node1.kafka.boer.lo:9092", "node2.kafka.boer.lo:9092", "node3.kafka.boer.lo:9092", "node4.kafka.boer.lo:9092"]
  topic: "%{[log_type]}"
  partition.round_robin:
    reachable_only: false
  required_acks: 1
  compression: lz4
  max_message_bytes: 1000000
```

### Logstash配置
```yaml
elasticsearch:
  host: elasticsearch-logging
  port: 9200

## ref: https://github.com/elastic/logstash-docker/blob/master/build/logstash/env2yaml/env2yaml.go
config:
  xpack.monitoring.enabled: true
  xpack.monitoring.elasticsearch.hosts: ["http://elasticsearch-logging:9200"]
  xpack.monitoring.elasticsearch.username: "logstash_system"
  xpack.monitoring.elasticsearch.password: "t6XK9kDvistPyuSvVwK3"
  config.reload.automatic: true
  config.reload.interval: 120
  path.config: /usr/share/logstash/pipeline
  path.data: /usr/share/logstash/data
  pipeline.workers: 12
  pipeline.batch.size: 16000
  pipeline.batch.delay: 10
  queue.type: memory
  queue.max_bytes: 5gb

inputs:
  main: |-
    input {
      kafka {
        bootstrap_servers => "10.10.62.38:9092,10.10.62.39:9092,10.10.62.40:9092"
        topics => ["app"]
        client_id => "app-logs"
        group_id => ["app-logs"]
        max_poll_records => "8000"
        consumer_threads => 4
        codec => "json"
      }
    }

filters:
  main: |-
    filter {
      grok {
        break_on_match => false
        pattern_definitions => {
            "TXID_PRE" => "TxId\s*\:\s*"
            "SDOT_SUF" => "\s+\,"
        }
        match => {
          "source" => "/home/boer/Logs/%{GREEDYDATA:app_name}.(boer|boermall).(lo|com|xyz)/%{GREEDYDATA:app_logfile}.log"
          "message" => "%{TIMESTAMP_ISO8601:log_timestamp}%{SPACE}%{WORD:log_level}%{DATA}%{TXID_PRE}%{DATA:log_txid}%{SDOT_SUF}%{GREEDYDATA}"
        }
        remove_field => [ "offset", "input_type", "input.type", "type", "tag", "source" ]
      }
    }

outputs:
  main: |-
    output {
      elasticsearch {
        hosts => ["http://elasticsearch-logging:9200"]
        index => "app-logs"
        user => "elastic"
        password => "rAQc9m19NdWcFIfLgNVQ"
      }
    }
```