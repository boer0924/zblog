---
title: Springboot日志配置
date: 2018-07-28 10:16:18
index_img: https://picsum.photos/300/200.webp?logback
tags:
  - Log4J2
  - Logback
  - SpringCloud
  - SpringBoot
categories: DevOps
---
本文展示两种日志文件命名格式：
格式一：
```
Boer-Office.springboot-produce.20180728.0.log
Boer-Office.springboot-produce.20180728.1.log
Boer-Office.springboot-produce.20180728.2.log <- 当前active日志
```
格式二：
```
Boer-Office.springboot-produce.20180728.0.log
Boer-Office.springboot-produce.20180728.1.log
Boer-Office.springboot-produce.log <- 当前active日志
```
一般根据日志文件的备份脚本会这么写：
> crontab - rsync: tar -zcf Boer-Office.springboot-produce.$(date +%Y%m%d).tgz Boer-Office.springboot-produce.$(date +%Y%m%d).*.log

简单、高效！

这样的话格式一不会有问题，格式二在传统虚拟机的部署方式下也不会有问题，但是在K8S下部署就会存在问题：考虑一下，假如当前active日志是`Boer-Office.springboot-produce.log`，这时由于某种原因服务挂了，kube-apiserver, kube-controller会配合kube-scheduler将应用重启(有可能会调度到其他node上)，此时当前active日志`Boer-Office.springboot-produce.log`并不会归档为`Boer-Office.springboot-produce.20180728.x.log`的格式，所以当备份脚本运行的时候`Boer-Office.springboot-produce.log`文件的日志就会丢失

<!-- more -->

### 1、Springboot配置
```yaml
logging:
  config: classpath:logback-spring.xml
  # config: classpath:logback-${spring.profiles.active}.xml
  # file:
  #   max-size: 10KB
  #   max-history: 7
  #   path: logs
  #   name: logs/${HOSTNAME}.${spring.application.name}.log
  # pattern:
  #   rolling-file-name: "logs/${HOSTNAME}.${spring.application.name}.%d{yyyyMMdd}.%i.log"
```

### 2、Custom Log Configuration
> src/main/resources/logback-spring.xml  即：classpath目录

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <conversionRule conversionWord="clr" converterClass="org.springframework.boot.logging.logback.ColorConverter"/>
  <conversionRule conversionWord="wex"
                  converterClass="org.springframework.boot.logging.logback.WhitespaceThrowableProxyConverter"/>
  <conversionRule conversionWord="wEx"
                  converterClass="org.springframework.boot.logging.logback.ExtendedWhitespaceThrowableProxyConverter"/>
  <property name="CONSOLE_LOG_PATTERN"
            value="${CONSOLE_LOG_PATTERN:-%clr(%d{${LOG_DATEFORMAT_PATTERN:-yyyy-MM-dd HH:mm:ss.SSS}}){faint} %clr(${LOG_LEVEL_PATTERN:-%5p}) %clr(${PID:- }){magenta} %clr(---){faint} %clr([%15.15t]){faint} %clr(%-40.40logger{39}){cyan} %clr(:){faint} %m%n${LOG_EXCEPTION_CONVERSION_WORD:-%wEx}}"/>
  <property name="FILE_LOG_PATTERN"
            value="${FILE_LOG_PATTERN:-%d{${LOG_DATEFORMAT_PATTERN:-yyyy-MM-dd HH:mm:ss.SSS}} ${LOG_LEVEL_PATTERN:-%5p} ${PID:- } --- [%t] %-40.40logger{39} : %m%n${LOG_EXCEPTION_CONVERSION_WORD:-%wEx}}"/>
  <property name="LOG_FILE" value="${LOG_FILE:-${LOG_PATH:-${LOG_TEMP:-${java.io.tmpdir:-/tmp}}}/spring.log}"/>

  <logger name="org.apache.catalina.startup.DigesterFactory" level="ERROR"/>
  <logger name="org.apache.catalina.util.LifecycleBase" level="ERROR"/>
  <logger name="org.apache.coyote.http11.Http11NioProtocol" level="WARN"/>
  <logger name="org.apache.sshd.common.util.SecurityUtils" level="WARN"/>
  <logger name="org.apache.tomcat.util.net.NioSelectorPool" level="WARN"/>
  <logger name="org.eclipse.jetty.util.component.AbstractLifeCycle" level="ERROR"/>
  <logger name="org.hibernate.validator.internal.util.Version" level="WARN"/>
  <logger name="org.springframework.boot.actuate.endpoint.jmx" level="WARN"/>

  <appender name="FILE"
            class="ch.qos.logback.core.rolling.RollingFileAppender">
    <encoder>
      <pattern>${FILE_LOG_PATTERN}</pattern>
    </encoder>
    <!-- <file>${LOG_FILE}</file> -->
    <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
      <cleanHistoryOnStart>${LOG_FILE_CLEAN_HISTORY_ON_START:-false}</cleanHistoryOnStart>
      <!-- <fileNamePattern>${ROLLING_FILE_NAME_PATTERN:-${LOG_FILE}.%d{yyyy-MM-dd}.%i.gz}</fileNamePattern> -->
      <fileNamePattern>logs/${HOSTNAME}.${APPNAME}.%d{yyyyMMdd}.%i.log</fileNamePattern>
      <maxFileSize>${LOG_FILE_MAX_SIZE:-1KB}</maxFileSize>
      <maxHistory>${LOG_FILE_MAX_HISTORY:-7}</maxHistory>
      <totalSizeCap>${LOG_FILE_TOTAL_SIZE_CAP:-0}</totalSizeCap>
    </rollingPolicy>
  </appender>

  <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>${CONSOLE_LOG_PATTERN}</pattern>
    </encoder>
  </appender>

  <root level="INFO">
    <appender-ref ref="CONSOLE"/>
    <appender-ref ref="FILE"/>
  </root>
</configuration>
```

### 3、Ref
- https://github.com/spring-projects/spring-boot/tree/master/spring-boot-project/spring-boot/src/main/resources/org/springframework/boot/logging/logback
- https://docs.spring.io/spring-boot/docs/current/reference/html/spring-boot-features.html#boot-features-logging