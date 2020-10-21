---
title: 中间件运维规范(初稿)
date: 2019-06-13 16:16:16
index_img: https://picsum.photos/300/200.webp?mw
tags:
  - RabbitMQ
  - Kafka
  - Elasticsearch
categories: DevOps
---
本文记录中间件`RabbitMQ`, `Kafka`, `Elasticsearch`系统的集群部署，需求方必备信息，日常巡检等应该check的重要节点。

<!-- more -->

# 中间件运维规范(初稿)

## os-level:
其他内核优化同操作系统内核基线
```
vm.max_map_count=262144

* soft nofile 102400
* hard nofile 204800
```

## RabbitMQ
一、集群部署
1. 配置MNESIA_BASE, LOG_BASE
2. 启动management, federation插件
3. 配置logrotate
4. 修改默认控制登录密码
5. 配置netdata监控, 并验证
6. 创建测试exchange\queue验证可用性
7. 创建元数据: vhost\exchange\queue\user\policy
8. 配置镜像队列

二、需求方提供信息
1. 集群信息
2. exchange 名字
3. exchange 类型
4. queue 名字
5. queue 是否持久化
6. routing_key

三、日常巡检
1. 内存、磁盘(全局流控)
2. rabbitmq进程fd、mmap占用量
3. 消息积压情况
4. 是否信用卡流控
5. connections/channel连接数量

## Kafka
一、集群部署
1. log.retention.hours 建议72甚至更小
2. num.replica.fetchers flowwers数据同步线程数, 建议cpu core数
3. num.recovery.threads.per.data.dir 数据恢复线程数, 建议cpu core数

二、需求方提供信息
1. topic名字, 建议name: test-for-native 中划线分割，避免下划线/点
2. 分区、副本数量, 建议分区为broker的倍数，副本数为3broker/2,5broker/3
3. 预估7/3天topic数据量(消息落盘后占用磁盘空间大小), 若topic数据量较大, 且重要级别较高建议副本为broker数
4. 消费积压监控功能netdata已在开发中...

三、日常巡检
1. 分区是否均衡、leader是否是优先副本
2. kafka配置data.dirs磁盘容量情况
3. kafka进程fd、mmap占用量

## ES
一、集群部署
1. cluster-name
2. node.name
3. network.host
4. jvm.options配置堆内存
5. discovery.zen.minimum_master_nodes: (N/2)+1 防脑裂

二、需求方提供信息
1. 索引名
2. 索引主分片、复制分片数量
3. 索引mapping
4. 索引管理策略(index分割策略、删除index策略等)
5. 预估索引占用磁盘空间大小
6. 是否需要其他es插件，并提供配置

三、日常巡检
1. 集群状态, 强制green
2. path.data配置占用磁盘容量情况
3. path.logs配置占用磁盘容量情况(考虑logrotate/log4j日志轮转)

## 配置示例

rabbitmq:
```
cluster_partition_handling = pause_minority
vm_memory_high_watermark = 0.4
vm_memory_high_watermark_paging_ratio = 0.75
hipe_compile = ture
queue_index_max_journal_entries = 262144
frame_max = 128KB
delegate_count = 16
msg_store_file_size_limit = 16MB
```

kafka:
```
broker.id=34
listeners=PLAINTEXT://10.193.196.34:9092
advertised.listeners=PLAINTEXT://10.193.196.34:9092
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
log.dirs=/home/finance/Data/kafka
num.partitions=9
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
#
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000
zookeeper.connect=10.193.196.32:2181,10.193.196.33:2181,10.193.196.34:2181/kafka
group.initial.rebalance.delay.ms=0
#
zookeeper.connection.timeout.ms=10000
#
log.retention.hours=24
offsets.retention.minutes=1440
#
auto.create.topics.enable=false
delete.topic.enable=true
auto.leader.rebalance.enable=true
#
num.network.threads=3
num.io.threads=8
num.recovery.threads.per.data.dir=6
num.replica.fetchers=3
log.cleaner.threads=3
```