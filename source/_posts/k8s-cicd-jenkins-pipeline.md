---
title: Kubernetes CICD工具Jenkins Pipeline
date: 2020-06-23 11:36:20
index_img: https://picsum.photos/300/200.webp?jenkins
tags:
  - Kubernetes
  - CICD
  - Jenkins
  - Pipeline
  - Harbor
categories: Kubernetes
---
### KubernetesPod.yaml
```yaml
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    jenkins-slave: true
spec:
  volumes:
    - name: maven-cache
      hostPath:
        path: /var/lib/cache/.m2
    - name: docker-sock
      hostPath:
        path: /var/run/docker.sock
    - name: docker-cache
      hostPath:
        path: /var/lib/docker
  containers:
    - name: jnlp
      image: jenkins/jnlp-slave:3.27-1
      tty: true
      command:
        - cat
    - name: maven
      image: maven:3.6.3-jdk-8
      command:
        - cat
      tty: true
      volumeMounts:
        - mountPath: /root/.m2
          name: maven-cache
    - name: docker
      image: docker:19.03.8
      volumeMounts:
        - mountPath: /var/run/docker.sock
          name: docker-sock
        - mountPath: /var/lib/docker
          name: docker-cache
      tty: true
      command:
        - cat
    - name: kubectl
      image: boer0924/kubectl:1.18.3
      tty: true
      command:
        - cat
```

### Jenkinsfile
```yaml
pipeline {
  agent {
    kubernetes {
      defaultContainer 'jnlp'
      yamlFile 'manifests/KubernetesPod.yaml'
    }
  }
  environment {
    name = 'boer'
  }
  parameters {
    string(name: 'PERSON', defaultValue: 'Mr Jenkins', description: 'Who should I say hello to?')
  }
  stages {
    stage('Test') {
      steps {
        echo "单元测试"
        sh 'echo "TEST"'
      }
    }

    stage('Maven') {
      steps {
        container('maven') {
          echo "编译打包"
          sh "mvn clean package -Dmaven.test.skip=true"
        }
      }
    }

    stage('Docker') {
      environment {
        registryUrl = 'registry.meitianiot.lo'
        // registryUser = 'deployer'
        // registryPass = 'Deployer@12345'
        registry = credentials('dockerhub')
        registryUser = "${registry_USR}"
        registryPass = "${registry_PSW}"
        image = "${registryUrl}/public/cicd-demo"
        imageTag = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
      }
      steps {
        container('docker') {
          echo "构建镜像"
          sh '''
          docker login ${registryUrl} -u ${registryUser} -p ${registryPass}
          docker build -t ${image}:${imageTag} .
          docker push ${image}:${imageTag}
          '''
        }
      }
    }

    stage('K8S') {
      environment {
        kubeconfig = credentials('kubeconfig')
      }
      steps {
        container('kubectl') {
          echo "Kubernetes发布"
          sh "kubectl --kubeconfig $kubeconfig get pods"
        }
      }
    }
  }
}
```