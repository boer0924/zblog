---
title: Redis KEYS命令引发的一次生产故障
date: 2021-03-03 16:30:18
index_img: https://picsum.photos/300/200.webp?redis-keys
tags:
  - Redis
categories: DevOps
---

硬件设备无Cookie机制 -> Session保存时间加长 -> spring-* Keys激增 -> KEYS TempLock_*慢日志 -> 应用响应速度慢

<!-- more -->

### 一、事件背景：
  按计划于2021年2月25日00：00开始停服上线，预计于2月25日凌晨2点完成上线，并交付测试产品同学测试，验证。

### 二、故障现象：
  从2月25日01：00左右开始，生产环境redis内存占用开始从300MB稳定上升，于25日上午10：30左右达到1200MB后：
1. 阿里云监控几乎所有指标开始频繁归零
2. Redis慢日志 KEYS TempLock_*
3. 监控趋势显示Redis内存使用量持续增大、Keys数量持续增大
4. 经分析工具分析内存占用清空 spring-session前缀的key峰值时占用1300M内存
5. 应用日志频繁间歇性报Redis connection timeout异常，应用健康检查地址连接超时导致告警

### 三、排查过程：
  通过以上各类监控系统观察得到的现象，做出如下尝试与努力：
1. KEYS TempLock_*慢日志：经研发排查代码发现此代码为2年前代码，此次上线未变更
2. 内存增长与keys数量增长：排查spring-session模块机制，结论如下：
- springboot 1.x 

  spring-session-data-redis 这个依赖 通过@EnableRedisHttpSession注解来开启配置 只要控制器(包括拦截器)有对session的处理，就会在redis写入3个key（hash\set\string各一）

- spring boot 2.x

  不需要注解开关来开启配置，默认只要控制器(包括拦截器)有对session的处理，就会在redis写入3个key（hash\set\string各一）

但是，在重构/升级前，即在springboot 1.x时@EnableRedisHttpSession注解就是开启的，即spring-session前缀的keys以前就存在。（我勒个去，一线希望又破灭了）

3. 阿里云监控频繁归零问题：提工单、电话沟通阿里云工程师，建议先优化慢日志、排查大key

### 四、故障处理
  经以上排查分析和阿里云工程师建议，此时已是清晨7.00时，马上早高峰业务量激增，再不修复后果不堪设想。

  抱着试一试的想法(因为之前排查过此代码为2年前代码)，决定先优化`hardHighLevelVideoService`，`hardParkLockService`，`hardVideoService`三个服务的KEYS TempLock_*慢日志，于26日7.40上线，上线后奇迹发生：

1. 阿里云监控频繁归零问题消除
2. keys、内存持续走低，过期的key持续走高
3. 业务响应速度有所改观

**至此，经过48小时、通宵2个晚上加班，此故障从现象上看已经修复**

### 五、根因分析
问题与思考：
1. KEYS TempLock_*慢日志以前就存在，为什么以前没有发生过历史问题？
2. spring-session前缀的keys以前就存在，上线后为什么会持续增多？

原来，`hardHighLevelVideoService`，`hardParkLockService`，`hardVideoService`三个服务26日7.40上线的时候，开发还改了一行代码。注释了在全局拦截器中操作session的代码 （只要控制器(包括拦截器)有对session的处理，就会在redis写入3个key（hash\set\string各一）），这才是消除故障的根本原因。

至此，虽然原因找到了，还是不能解释 
> 2、spring-session前缀的keys以前就存在，上线后为什么会持续增多？

最后经周一研发分析，SpringBoot版本从1.5.13版本使用RedisOperationsSessionRepository，升
级后，在高版本过期，使用的则是RedisIndexedSessionRepository，二者对于配置的参数读取发生了
改变，。导致session会话保存时间不同，在springboot1.x取默认值1800s，而springboot2.x取配置值86400s，因为高位视频等硬件设备没有cookie不会保存session, 每次硬件设备心跳都会经全局拦截器产生不同session，之前过期时间为1800s，现在为24hour(86400s), 导致keys数量激增，之前在keys少的时候KEYS TempLock_*慢日志不足为患，然而在keys激增后，KEYS命令会每次扫描所有的keys，导致redis在执行KEYS时，应用连接redis connection timeout, 进而使业务响应速度下降。

---

### 应急处理措施：
1. 因内存使用量持续增长，已接近内存最大值2G，根据内存增长速度以及故障排查进度，在25日17.00时对Redis服务进行扩容到16G，事实证明扩容的决策是及时的、正确的。
2. 通过观察调取各类监控系统，积极研究排查故障原因。
3. 工单、电话联系阿里云工程师，寻求援助并排除阿里云Redis服务本身问题。

### Ref
- https://blog.didispace.com/spring-session-source-learning-xjf/