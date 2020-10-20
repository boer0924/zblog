---
title: Kubernetes CICD工具Drone
date: 2020-06-24 11:36:20
index_img: https://picsum.photos/300/200.webp?drone
tags:
  - Kubernetes
  - CICD
  - Jenkins
  - Pipeline
  - Drone
  - Harbor
categories: Kubernetes
---
Drone是一个Go语言实现的CICD编排工具，超级轻量级。

Drone by Harness™ is a modern Continuous Integration platform that empowers busy teams to automate their build, test and release workflows using a powerful, cloud native pipeline engine.
<!-- more -->

```yaml
---
kind: pipeline
type: kubernetes
name: boer

steps:
  - name: build
    image: maven:3.6.3-jdk-8
    pull: if-not-exists
    volumes:
      - name: maven-cache
        path: /root/.m2
    commands:
      - mvn clean package -DskipTests=true
  - name: package
    image: docker:19.03.8
    pull: if-not-exists
    volumes:
      - name: docker-sock
        path: /var/run/docker.sock
      - name: docker-cache
        path: /var/lib/docker
    environment:
      repo: registry.boer.xyz/public/spring-produce
      registry: registry.boer.xyz
      username:
        from_secret: docker_username
      password:
        from_secret: docker_password
      tags: "${DRONE_COMMIT_SHA:0:10}"
    commands:
      - docker login ${registry} -u ${username} -p ${password}
      - docker build -t "${repo}:${tags}" .
      - docker push "${repo}:${tags}"
  - name: k8s
    image: boer0924/kubectl:1.18.3
    pull: if-not-exists
    volumes:
      - name: kube-config
        path: /root/.kube/config
    commands:
      - kubectl get nodes
trigger:
  branch:
    - master
  event:
    - push
volumes:
  - name: maven-cache
    host:
      path: /var/lib/cache/.m2
  - name: kube-config
    host:
      path: /root/.kube/config
  - name: docker-cache
    host:
      path: /var/lib/docker
  - name: docker-sock
    host:
      path: /var/run/docker.sock
```