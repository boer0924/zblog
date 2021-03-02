---
title: APM - Pinpoint笔记
date: 2019-05-09 15:40:54
index_img: https://picsum.photos/300/200.webp?apm
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags: APM
categories: DevOps
---
### Ref
- [https://naver.github.io/pinpoint/installation.html](https://naver.github.io/pinpoint/installation.html)
- [https://naver.github.io/pinpoint/faq.html](https://naver.github.io/pinpoint/faq.html)

<!-- more -->

### 组件说明
| **HBase**              | for storage                                  |
| ---------------------- | -------------------------------------------- |
| **Pinpoint Collector** | Pinpoint core                                |
| **Pinpoint Web**       | Web UI                                       |
| **Pinpoint Agent**     | attached to a java application for profiling |

### hbase脚本
```bash
https://github.com/naver/pinpoint/tree/master/hbase/scripts
```

### War包部署方式
```bash
curl -LO https://archive.apache.org/dist/hbase/1.2.7/hbase-1.2.7-bin.tar.gz
下载pinpoint组件war/jar包
https://github.com/naver/pinpoint/releases

https://raw.githubusercontent.com/naver/pinpoint/master/hbase/scripts/hbase-create.hbase
bin/hbase shell ./hbase-create.hbase
```

### Docker部署方式
```bash
https://github.com/naver/pinpoint-docker
docker-compose pull
docker-compose up -d
docker-compose ps
```

### Agent配置
```bash
https://github.com/naver/pinpoint/blob/master/doc/installation.md#profiles-2

vim $Agent_Home/pinpoint.config
pinpoint.profiler.profiles.active=release
# 替换全部127.0.0.1为你自己的pinpoint server地址

vim profiles/release/pinpoint-env.config # release对应上面配置文件pinpoint.profiler.profiles.active=release
# 替换全部127.0.0.1为你自己的pinpoint server地址
profiler.sampling.rate=<your-want> # agent采样频率
```

### 应用配置
```bash
-javaagent:${pinpointPath}/pinpoint-bootstrap-2.0.2.jar
-Dpinpoint.applicationName=< 应用名, length<24 >
-Dpinpoint.agentId=< 全局唯一, length<24 >
```

### 填坑
- 服务名 & AgentID长度不能超过24 `https://github.com/naver/pinpoint/issues/3504`
- AgentID全局唯一

### 删除AgentID/APP
```bash
https://pinpoint-apm.github.io/pinpoint/faq.html#how-do-i-delete-application-name-andor-agent-id-from-hbase

http://pinpoint.boer.xyz/admin/removeAgentId.pinpoint?applicationName=OrderService&agentId=cdc15ef982f5a09f&password=admin
```

### 修改HBase数据保存时间
```bash
# Shortening the TTL values, especially for `AgentStatV2` and `TraceV2`
describe 'TraceV2'
disable 'TraceV2'
alter 'TraceV2', {NAME => 'S', TTL => '604800'} # 7days
enable 'TraceV2'
describe 'TraceV2'

# 业务低峰期major_compact
hbase shell < https://github.com/naver/pinpoint/blob/master/hbase/scripts/hbase-major-compact-htable.hbase
```

---

Stay Hungry, Stay Foolish.