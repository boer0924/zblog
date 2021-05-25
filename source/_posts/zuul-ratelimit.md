---
title: ZUUL网关API接口防刷限流
date: 2021-05-21 16:30:18
index_img: https://picsum.photos/300/200.webp?zuul
tags:
  - zuul
  - api
  - ratelimit
categories: SRE
---
Spring Cloud Zuul RateLimit对Zuul APIGateway进行限流

<!-- more -->

### 1、POM依赖
```xml
# Spring Cloud Zuul RateLimit
<dependency>
    <groupId>com.marcosbarbero.cloud</groupId>
    <artifactId>spring-cloud-zuul-ratelimit</artifactId>
    <version>2.2.7.RELEASE</version>
</dependency>

# Redis
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 2、YAML配置
```yaml
spring:
  application:
    name: springcloud-zuul
  profiles:
    active: ${ENVIRONMENT:pro}
  redis:
    host: 10.10.253.16
    port: 6379
server:
  port: 8125
zuul:
  routes:
    springboot-produce:
      path: /api/produce/**
    springboot-consume:
      path: /api/consume/**
  ratelimit:
    enabled: true
    repository: REDIS
    key-prefix: zrl-
    behind-proxy: true
    add-response-headers: false
    deny-request:
      response-status-code: 404
      origins:
        - boer.xyz
    default-policy-list:
      - limit: 20
        refresh-interval: 30
        type:
          - origin
          - url
    policy-list:
      springboot-produce:
        - limit: 5
          refresh-interval: 60
          type:
            - url=/hello
```

### 3、Test验证
```bash
# 对/hello接口每分钟限制5次访问
curl -is http://10.10.10.56:8125/api/produce/hello
# 对其他接口无限制
curl -is http://10.10.10.56:8125/api/produce/
```

### 4、Ref参考
1. https://github.com/marcosbarbero/spring-cloud-zuul-ratelimit/tree/2.2.x
2. https://www.baeldung.com/spring-cloud-zuul-rate-limit