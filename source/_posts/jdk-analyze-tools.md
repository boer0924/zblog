---
title: Java分析工具
date: 2018-06-24 11:16:18
index_img: https://picsum.photos/300/200.webp?jstack
tags:
  - JDK
categories: DevOps
---
1. jps:查看本机的Java中进程信息。
2. jstack:打印线程的栈信息,制作线程Dump。
3. jmap:打印内存映射,制作堆Dump。
4. jstat:性能监控工具。
5. jhat:内存分析工具。
6. jconsole:简易的可视化控制台。
7. jvisualvm:功能强大的控制台。

<!-- more -->

```bash
jps -l
top -Hp 14583
printf "%x\n" 14619
391b
391a
3919
3918

su - meisapp

jstack pid | egrep -A50 391[ab89]

jstat -gcutil 14583 2000 10

jmap -dump:format=b,file=heapDump.hprof 14583
jhat heapDump.hprof


-XX:+HeapDumpOnOutOfMemoryError

-XX:HeapDumpPath=./

# CMS
-Xms200M
-Xmx200M
-XX:+UseConcMarkSweepGC
-XX:CMSInitiatingOccupancyFraction=92
-XX:+UseCMSInitiatingOccupancyOnly
-XX:CMSBootstrapOccupancy=92
-xx:CMSWaitDuration=2000
# -verbose:gc
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:./gc.log
-XX:+UseGCLogFileRotation
-XX:NumberOfGCLogFiles=1
-XX:GCLogFileSize=512M

# G1
-Xms200M
-Xmx200M
-XX:+UseG1GC
-XX:SurvivorRatio=8
-XX:MaxTenuringThreshold=1
-XX:+UnlockExperimentalVMOptions
-XX:G1MaxNewSizePercent=50
-XX:G1HeapRegionSize=4M
-XX:+PrintGC
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:./gc.log

```

### Reference
https://www.hollischuang.com/archives/308
https://www.cnblogs.com/chiangchou/p/jvm-4.html