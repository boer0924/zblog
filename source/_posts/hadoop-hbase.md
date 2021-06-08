---
title: 大数据Hadoop-HBase集群环境构建
date: 2021-06-06 16:16:16
index_img: https://picsum.photos/300/200.webp?bd
tags:
  - Hadoop
  - HDFS
  - Yarn
  - HBase
categories: BigData
---

HDFS NameNode DataNode
Yarn ResourceManager NodeManager
HBase HMaster HRegionServer

三个组件均采用Active-Standby主备模式，但Active选主方法不尽相同。
HDFS HA通过JournalNode选举active NameNode，通过ZKFC(DFSZKFailoverController)实现自动故障转移

服务启动方式基本相同
hadoop-daemon.sh
hadoop-daemons.sh
yarn-daemon.sh
yarn-daemons.sh
hbase-daemon.sh
hbase-daemons.sh

服务管理方式基本类似
hadoop/etc/hadoop/slaves
hbase/conf/backup-masters
hhase/conf/regionservers
通过定义target文件，使用ssh免密实现统一管理远程服务

<!-- more -->

## 1. 环境信息
Hostname | IPAdress | Zookeeper | NameNode[zkfc] | JournalNode | DataNode | RM | NM | HMaster | HRegionServer |
| - | - | - | - | - | - | - | - | - | - |
vm-node001 | 10.10.253.16 | yes | yes | yes | no  | no  | no  | yes | yes |
vm-node002 | 10.10.253.17 | yes | yes | yes | yes | yes | yes | no  | yes |
vm-node003 | 10.10.253.18 | yes | no  | yes | yes | yes | yes | yes | yes |
**注意配置hosts/dns**

## 2. 版本选择
https://hbase.apache.org/book.html#hadoop
**Hadoop 2.x is recommended.**

https://hadoop.apache.org/docs/r2.10.1/

**Binary download**
- curl -LO https://mirrors.tuna.tsinghua.edu.cn/apache/hadoop/common/hadoop-2.10.1/hadoop-2.10.1.tar.gz
- curl -LO https://downloads.apache.org/hbase/2.3.5/hbase-2.3.5-bin.tar.gz
- curl -LO https://downloads.apache.org/zookeeper/zookeeper-3.6.3/apache-zookeeper-3.6.3-bin.tar.gz
- curl -LO https://archive.apache.org/dist/pulsar/pulsar-2.6.4/apache-pulsar-2.6.4-bin.tar.gz
- curl -LO https://mirrors.bfsu.edu.cn/apache/flink/flink-1.12.4/flink-1.12.4-bin-scala_2.11.tgz

组件 | 版本
| - | - 
Hadoop | 2.10.1
HBase | 2.3.5
Zookeeper | 3.6.3
Pulsar | 2.6.4
Flink | 1.12.4

## 3. Hadoop安装配置
### 配置集群

core配置
```xml
<configuration>
  <property>
    <name>fs.defaultFS</name>
    <value>hdfs://mycluster</value>
  </property>
  <property>
    <name>io.file.buffer.size</name>
    <value>131072</value>
  </property>
  <property>
    <name>fs.trash.interval</name>
    <value>10</value>
  </property>
  <property>
    <name>hadoop.tmp.dir</name>
    <value>/srv/hadoop/tmp</value>
  </property>
  <property>
    <name>ha.zookeeper.quorum</name>
    <value>vm-node001:2181,vm-node002:2181,vm-node003:2181</value>
  </property>
</configuration>
```

hdfs配置
```xml
<configuration>
  <property>
    <name>dfs.nameservices</name>
    <value>mycluster</value>
  </property>
  <property>
    <name>dfs.replication</name>
    <value>1</value>
  </property>
  <property>
    <name>dfs.blocksize</name>
    <value>268435456</value>
  </property>
  <property>
    <name>dfs.namenode.name.dir</name>
    <value>/srv/hadoop/name</value>
  </property>
  <property>
    <name>dfs.datanode.data.dir</name>
    <value>/srv/hadoop/data</value>
  </property>
  <property>
    <name>dfs.namenode.checkpoint.dir</name>
    <value>/srv/hadoop/checkpoint</value>
  </property>
  <property>
    <name>dfs.journalnode.edits.dir</name>
    <value>/srv/hadoop/journalnode</value>
  </property>
  <property>
    <name>dfs.namenode.handler.count</name>
    <value>10</value>
  </property>
  <property>
    <name>dfs.datanode.handler.count</name>
    <value>10</value>
  </property>
  <property>
    <name>dfs.ha.namenodes.mycluster</name>
    <value>nn1,nn2</value>
  </property>
  <property>
    <name>dfs.namenode.rpc-address.mycluster.nn1</name>
    <value>vm-node001:8020</value>
  </property>
  <property>
    <name>dfs.namenode.rpc-address.mycluster.nn2</name>
    <value>vm-node002:8020</value>
  </property>
  <property>
    <name>dfs.namenode.http-address.mycluster.nn1</name>
    <value>vm-node001:50070</value>
  </property>
  <property>
    <name>dfs.namenode.http-address.mycluster.nn2</name>
    <value>vm-node002:50070</value>
  </property>
  <property>
    <name>dfs.namenode.shared.edits.dir</name>
    <value>qjournal://vm-node001:8485;vm-node002:8485;vm-node003:8485/mycluster</value>
  </property>
  <property>
    <name>dfs.client.failover.proxy.provider.mycluster</name>
    <value>org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider</value>
  </property>
  <property>
    <name>dfs.ha.fencing.methods</name>
    <value>shell(/bin/true)</value>
  </property>
  <property>
    <name>dfs.ha.automatic-failover.enabled</name>
    <value>true</value>
  </property>
  <property>
    <name>dfs.datanode.max.transfer.threads</name>
    <value>4096</value>
  </property>
</configuration>
```

yarn配置
```xml
<configuration>
  <property>
    <name>yarn.nodemanager.aux-services</name>
    <value>mapreduce_shuffle</value>
  </property>
  <property>
    <name>yarn.resourcemanager.ha.enabled</name>
    <value>true</value>
  </property>
  <property>
    <name>yarn.resourcemanager.cluster-id</name>
    <value>mycluster</value>
  </property>
  <property>
    <name>yarn.resourcemanager.ha.rm-ids</name>
    <value>rm1,rm2</value>
  </property>
  <property>
    <name>yarn.resourcemanager.hostname.rm1</name>
    <value>vm-node002</value>
  </property>
  <property>
    <name>yarn.resourcemanager.hostname.rm2</name>
    <value>vm-node003</value>
  </property>
  <property>
    <name>yarn.resourcemanager.webapp.address.rm1</name>
    <value>vm-node002:8088</value>
  </property>
  <property>
    <name>yarn.resourcemanager.webapp.address.rm2</name>
    <value>vm-node003:8088</value>
  </property>
  <property>
    <name>yarn.resourcemanager.zk-address</name>
    <value>vm-node001:2181,vm-node002:2181,vm-node003:2181</value>
  </property>
</configuration>
```

mapred配置
```xml
<configuration>
  <property>
    <name>mapreduce.framework.name</name>
    <value>yarn</value>
  </property>
</configuration>
```

hadoop环境配置
```shell
# The only required environment variable is JAVA_HOME.  All others are
# optional.  When running a distributed configuration it is best to
# set JAVA_HOME in this file, so that it is correctly defined on
# remote nodes.

# The java implementation to use.
# export JAVA_HOME=${JAVA_HOME}
export JAVA_HOME=/usr/local/jdk8u292-b10

# The maximum amount of heap to use, in MB. Default is 1000.
# export HADOOP_HEAPSIZE=
export HADOOP_HEAPSIZE=4096
export HADOOP_LOG_DIR=/srv/hadoop/logs
# export HADOOP_PID_DIR=${HADOOP_PID_DIR}
export HADOOP_PID_DIR=/srv/hadoop/pids
```

yarn环境配置
```shell
export JAVA_HOME=/usr/local/jdk8u292-b10
YARN_HEAPSIZE=4096
export YARN_RESOURCEMANAGER_HEAPSIZE=2048
export YARN_NODEMANAGER_HEAPSIZE=2048
YARN_LOG_DIR=/srv/hadoop/logs
export YARN_PID_DIR=/srv/hadoop/pids
```

日志配置
```shell
# etc/hadoop/log4j.properties
hadoop.log.dir=/srv/hadoop/logs
```

Slave配置
```bash
# etc/hadoop/slaves
vm-node002
vm-node003
```

### SSH免密
```bash
ssh-keygen # 回车N+
ssh-copy-id $(whoami)@vm-node002 # etc/hadoop/slaves
ssh-copy-id $(whoami)@vm-node003 # etc/hadoop/slaves
```

### 启动集群
```bash
bin/hdfs zkfc -formatZK

bin/hdfs namenode -format

# sbin/start-all.sh
# bin/hdfs namenode -bootstrapStandby
# sbin/stop-all.sh

## 建议阅读此二脚本
sbin/start-dfs.sh # namenode执行
bin/hdfs namenode -bootstrapStandby # namenode standby执行
sbin/start-yarn.sh # resourcemanager执行
```

### FQA
#### 1、No valid image files found
```bash
# makedirs
/srv/
├── hadoop
│   ├── checkpoint
│   ├── data
│   ├── journalnode
│   ├── logs
│   ├── name
│   ├── pids
│   └── tmp
├── hbase
|   ├── logs
│   └── pids
└── zookeeper

# good idea
bin/hdfs namenode -bootstrapStandby

# bad idea
# vm-node001
scp -r /srv/hadoop/name/current root@vm-node002:/srv/hadoop/name/
```

### Oops
```bash
sbin/start-yarn.sh
# start resourceManager
sbin/yarn-daemon.sh --config $YARN_CONF_DIR  start resourcemanager
sbin/yarn-daemons.sh --config $YARN_CONF_DIR  start resourcemanager

bin/hdfs haadmin -getServiceState nn1

bin/yarn rmadmin -getServiceState rm1
yarn rmadmin -transitionToStandby rm1
```


## 4. HBase安装配置

配置
`vim conf/hbase-site.xml`
```xml
<configuration>
  <property>
    <name>hbase.rootdir</name>
    <value>hdfs://mycluster/hbase</value>
  </property>
  <property>
    <name>hbase.cluster.distributed</name>
    <value>true</value>
  </property>
  <property>
    <name>hbase.unsafe.stream.capability.enforce</name>
    <value>false</value>
  </property>
  <property>
    <name>hbase.zookeeper.quorum</name>
    <value>vm-node001,vm-node002,vm-node003</value>
  </property>
  <property>
    <name>hbase.zookeeper.property.clientPort</name>
    <value>2181</value>
  </property>
</configuration>
```

环境变量
`vim conf/hbase-env.sh`
```shell
export JAVA_HOME=/usr/local/jdk8u292-b10
export HBASE_HEAPSIZE=1G
export SERVER_GC_OPTS="-verbose:gc -XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:<FILE-PATH>"

export HBASE_REGIONSERVERS=${HBASE_HOME}/conf/regionservers
export HBASE_BACKUP_MASTERS=${HBASE_HOME}/conf/backup-masters

export HBASE_LOG_DIR=/srv/hbase/logs
export HBASE_PID_DIR=/srv/hbase/pids

# Tell HBase whether it should manage it's own instance of ZooKeeper or not.
# export HBASE_MANAGES_ZK=true
export HBASE_MANAGES_ZK=false
```

日志配置
`vim conf/log4j.properties`
```properties
hbase.log.dir=/srv/hbase/logs
# add other you want.
```

regionservers配置
`vim conf/regionservers`
```
vm-node001
vm-node002
vm-node003
```

backup-masters配置
`vim conf/backup-masters`
```
vm-node003
```

### SSH免密
```bash
ssh-keygen # 回车N+
ssh-copy-id $(whoami)@vm-node001 # conf/backup-masters or conf/regionservers
ssh-copy-id $(whoami)@vm-node002 # conf/backup-masters or conf/regionservers
ssh-copy-id $(whoami)@vm-node003 # conf/backup-masters or conf/regionservers
```

### HA HDFS适配
拷贝Hadoop etc/hadoop/{core-site.xml,hdfs-site.xml}到HBase conf/{core-site.xml,hdfs-site.xml}
`cp ${HADOOP_HOME}/etc/hadoop/{core-site.xml,hdfs-site.xml} ${HBASE_HOME}/conf/{core-site.xml,hdfs-site.xml}`

### 启动与停止
```bash
bin/start-hbase.sh
bin/stop-hbase.sh
```

## 5. Reference
- https://hadoop.apache.org/docs/r2.10.1/hadoop-project-dist/hadoop-common/ClusterSetup.html
- https://hadoop.apache.org/docs/r2.10.1/hadoop-project-dist/hadoop-hdfs/HDFSHighAvailabilityWithQJM.html
- https://hadoop.apache.org/docs/r2.10.1/hadoop-yarn/hadoop-yarn-site/ResourceManagerHA.html
- https://hadoop.apache.org/docs/r2.10.1/hadoop-project-dist/hadoop-common/FileSystemShell.html
- https://hbase.apache.org/book.html#getting_started
- https://ken.io/note/hadoop-cluster-deploy-guide