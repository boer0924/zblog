---
title: Elasticsearch数据迁移
date: 2019-03-24 16:36:20
index_img: https://picsum.photos/300/200.webp?esd
tags:
  - Elasticsearch
  - Logstash
  - reindex
categories: Elastic
---

1. _reindex适用场景 [https://www.elastic.co/guide/en/elasticsearch/reference/6.1/docs-reindex.html](https://www.elastic.co/guide/en/elasticsearch/reference/6.1/docs-reindex.html)
  - 同一集群不同索引数据迁移
  - 不同集群索引数据迁移
2. 动态调整迁移速度
3. 随时取消任务
4. Built-in，无需安装(反例logstash)
5. 5.x - 7.x版本api均包含以上功能(可做为es数据迁移通用方案)
6. _reindex、logstash等都通过scroll\bulk API实现，读写性能无差别
7. logstash等三方工具适合blue-green网络不可达的情况下，作为代理迁移数据 (blue - green不通，blue -> logstash -> green代理)

<!-- more -->

### 场景

es集群

| node | type |
| - | - |
| 10.10.62.20 | - |
| 10.10.62.21 | - |
| 10.10.62.22 | - |
| 10.10.62.80 | hot |
| 10.10.62.81 | hot |
| 10.10.62.82 | hot |

索引`message_qq_201812`在节点`10.10.62.20, 10.10.62.21, 10.10.62.22`, 计划迁移到节点`10.10.62.80, 10.10.62.81, 10.10.62.82`的`message_wechat_201812`索引, 观察无异常后下线节点`10.10.62.20, 10.10.62.21, 10.10.62.22`


### 1、创建index模板
**消息平台已存在index模板**
```bash
curl -XPUT http://<es-client>:9200/_template/message_wechat_template -H 'Content-Type: application/json' -d '{
  "order": 0,
  "index_patterns": [
    "message_wechat*"
  ],
  "settings": {
    "index": {
      "number_of_shards": "3",
      "number_of_replicas": "1",
      "routing": {
        "allocation": {
          "require": {
            "box_type": "hot"
          }
        }
      }
    }
  },
  "mappings": {},
  "aliases": {
    "message_wechat": {}
  }
}'
```

### 2、 创建index
```bash
curl -XPUT http://<es-client>:9200/message_wechat_201812

curl http://<es-client>:9200/_cat/shards/message_wechat_201812 # 确认shards在目标主机
```

### 3、执行迁移

`message_qq_201812` -> `message_wechat_201812`
```bash
curl -XPOST http: //<es-client>:9200/_reindex?wait_for_completion=false -H 'Content-Type: application/json' -d '{
  "source": {
    "index": "message_qq_201812",
    "size": 1000
  },
  "dest": {
    "index": "message_wechat_201812"
  }
}'
```
> **记录taskId** `{"task":"YoYJXpjnQICRtr5EErLZQA:3208554"}`

### 4、动态调整速度
```bash
curl -XPOST http://<es-client>:9200/_reindex/YoYJXpjnQICRtr5EErLZQA:3208554/_rethrottle?requests_per_second=1000
```

### 5、取消任务
`curl -XPOST http://<es-client>:9200/_tasks/YoYJXpjnQICRtr5EErLZQA:3208554/_cancel`

### 6、删除老index

> 待新索引验证无误后

`curl -XDELETE http://<es-client>:9200/message_qq_201812`

### 7、.task索引
手动创建_reindex等task后，es会自动创建一个.task的index
1. 删除.task，如序6
2. 让es自动迁移.tasks, 如序8

### 8、逐台下线老节点

**注意: 逐台平滑下线**