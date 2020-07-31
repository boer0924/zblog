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
持续构建与发布是我们日常工作中必不可少的一个步骤，目前大多公司都采用 Jenkins 集群来搭建符合需求的 CI/CD 流程，然而传统的 Jenkins Slave 一主多从方式会存在一些痛点，比如：

- 主 Master 发生单点故障时，整个流程都不可用了
- 每个 Slave 的配置环境不一样，来完成不同语言的编译打包等操作，但是这些差异化的配置导致管理起来非常不方便，维护起来也是比较费劲
- 资源分配不均衡，有的 Slave 要运行的 job 出现排队等待，而有的 Slave 处于空闲状态
- 资源有浪费，每台 Slave 可能是物理机或者虚拟机，当 Slave 处于空闲状态时，也不会完全释放掉资源。

<!-- more -->

正因为上面的这些种种痛点，我们渴望一种更高效更可靠的方式来完成这个 CI/CD 流程，而 Docker 虚拟化容器技术能很好的解决这个痛点，又特别是在 Kubernetes 集群环境下面能够更好来解决上面的问题，下图是基于 Kubernetes 搭建 Jenkins 集群的简单示意图：
![](/img/k8s-jenkins-arch.png)

从图上可以看到 Jenkins Master 和 Jenkins Slave 以 Pod 形式运行在 Kubernetes 集群的 Node 上，Master 运行在其中一个节点，并且将其配置数据存储到一个 Volume 上去，Slave 运行在各个节点上，并且它不是一直处于运行状态，它会按照需求动态的创建并自动删除。

这种方式的工作流程大致为：当 Jenkins Master 接受到 Build 请求时，会根据配置的 Label 动态创建一个运行在 Pod 中的 Jenkins Slave 并注册到 Master 上，当运行完 Job 后，这个 Slave 会被注销并且这个 Pod 也会自动删除，恢复到最初状态。

那么我们使用这种方式带来了哪些好处呢？

- 服务高可用，当 Jenkins Master 出现故障时，Kubernetes 会自动创建一个新的 Jenkins Master 容器，并且将 Volume 分配给新创建的容器，保证数据不丢失，从而达到集群服务高可用。
- 动态伸缩，合理使用资源，每次运行 Job 时，会自动创建一个 Jenkins Slave，Job 完成后，Slave 自动注销并删除容器，资源自动释放，而且 Kubernetes 会根据每个资源的使用情况，动态分配 Slave 到空闲的节点上创建，降低出现因某节点资源利用率高，还排队等待在该节点的情况。
- 扩展性好，当 Kubernetes 集群的资源严重不足而导致 Job 排队等待时，可以很容易的添加一个 Kubernetes Node 到集群中，从而实现扩展。 当然这也是 Kubernetes 集群本来的便捷性。

### Jenkins Pipeline
Jenkins流水线是一套插件，它支持实现和集成持续交付流水线到Jenkins中。

Jenkinsfile一般有几个配置管理方式：
1. 在Jenkins WebUI中配置管理
2. 检入到源码管理系统中配置管理(推荐方式)

Jenkinsfile: 创建一个检入到源码管理系统中的`Jenkinsfile`带来了一些直接的好处：
1. 流水线上的代码评审/迭代
2. 对流水线进行审计跟踪
3. 流水线的单一可信数据源，能够被项目的多个成员查看和编辑

流水线支持 两种语法：声明式（在 Pipeline 2.5 引入）和脚本式流水线。[官方文档](https://www.jenkins.io/doc/book/pipeline/syntax/)

### Jenkins安装
```
helm fetch stable/jenkins -version 2.1.2
tar -zxf jenkins-2.1.2.tgz
vim jenkins/values.yaml
helm install --name jenkins -f values.yaml . --namespace devops
helm upgrade jenkins -f values.yaml . --namespace devops
helm delete --purge jenkins
```
> https://github.com/helm/charts/tree/master/stable/jenkins#200-configuration-as-code-now-default--container-does-not-run-as-root-anymore
```yaml
# values.yaml
clusterZone: "cluster.local"
master:
  numExecutors: 2 # 允许在master节点上同时执行2个任务
  # https://github.com/helm/charts/tree/master/stable/jenkins#200-configuration-as-code-now-default--container-does-not-run-as-root-anymore
  enableXmlConfig: true # 允许变更配置 -> <your-jenkins-ingress>/configureSecurity此url下设置`安全域`为`Jenkins专有用户数据库`
  resources:
    requests:
      cpu: "50m"
      memory: "256Mi"
    limits:
      cpu: "1000m"
      memory: "1024Mi"
  installPlugins:
    - kubernetes:1.25.7
    - workflow-job:2.39
    - workflow-aggregator:2.6
    - credentials-binding:1.23
    - git:4.2.2
    - configuration-as-code:1.41
    - blueocean:1.23.2
    - git-parameter:0.9.12
    - localization-zh-cn:1.0.17
  ingress:
    enabled: true
    hostName: jenkins.boer.xyz
agent:
  enabled: false # 我们在pipeline中自定义Agent Pod
persistence:
  enabled: true
  storageClass: openebs-hostpath
  accessMode: "ReadWriteOnce"
  size: "2Gi"
```

必备Plugins:
- kubernetes:1.25.7
- workflow-job:2.39
- workflow-aggregator:2.6
- credentials-binding:1.23
- git:4.2.2
- configuration-as-code:1.41
- blueocean:1.23.2
- git-parameter:0.9.12
- localization-zh-cn:1.0.17

### Jenkins配置操作

#### 全局安全配置
> 系统管理 -> 全局安全配置 -> Authentication -> 安全域 -> Jenkins专有用户数据库

![auth](/img/jenkins_auth.png)

#### 添加全局凭证
> 系统管理 -> Manage Credentials -> Stores scoped to Jenkins -> Jenkins -> 全局凭据 (unrestricted) -> 添加凭据

##### 1. 添加`代码仓库`凭证

![key-gitea](/img/jenkins_key_gitea.jpg)

##### 2. 添加Harbor Registry凭证

  - 方法同添加`代码仓库`凭证
  - 添加harbor统一镜像拉取账号 [参考](/2019/09/09/k8s-registry-harbor/#%E5%88%9B%E5%BB%BARegistry-secret)

##### 3. 添加kubeconfig凭证

![key-kubeconfig](/img/jenkins_key_kubeconfig.jpg)

### KubernetesPod.yaml

**划重点**
1. maven缓存.m2
2. docker in docker
3. jnlp容器必须有，command不能覆盖jenkins-slave

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

**划重点**
1. 定义agent label是为在k8s中调度job的pod名字
2. 定义parameters来选择需要部署的环境。即namespace
3. Jenkinsfile的两个全局变量：env/params。
  - 设置env变量: env.KEY = value
  - 使用env变量: ${KEY}
4. username&password凭证的使用: registryCre = credentials('registry') [_USR/_PSW]
  - 获取username: ${registryCre_USR}
  - 获取passowrd: ${registryCre_PSW}
5. 使用short commit_id作为image_tag 和 kubernetes.io/change-cause, 以保证镜像唯一，和可以回退到指定版本。
6. sed动态修改k8s资源定义文件manifests/k8s.yaml：
  - <CHANGE_CAUSE>: 便于指定版本回退
  - <IMAGE_TAG>: 指定版本
  - <INGRESS>: 不同环境不同域名

```yaml
pipeline {
  agent {
    kubernetes {
      label 'jenkins-worker'
      defaultContainer 'jnlp'
      yamlFile 'manifests/KubernetesPod.yaml'
    }
  }
  parameters {
    choice(name: 'ENV', choices: ['test', 'pre', 'prod'], description: '选择部署环境？')
  }
  environment {
    AUTHOR = 'boer'
    EMAIL = 'boer0924@gmail.com'
  }
  stages {
    stage('Test') {
      steps {
        echo "单元测试"
        echo "TEST"
        script {
          if ("${params.ENV}" == 'test') {
            env.NAMESPACE = 'boer-test'
            env.INGRESS = 'test.consume.boer.xyz'
          }
          if ("${params.ENV}" == 'pre') {
            env.NAMESPACE = 'boer-pre'
            env.INGRESS = 'pre.consume.boer.xyz'
          }
          if ("${params.ENV}" == 'prod') {
            env.NAMESPACE = 'boer-prod'
            env.INGRESS = 'consume.boer.xyz'
          }
        }
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
        registryUrl = 'registry.boer.xyz'
        registryCre = credentials('dockerhub')
        registryUser = "${registryCre_USR}"
        registryPass = "${registryCre_PSW}"
        image = "${registryUrl}/public/spring-consume"
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
          sh '''
          sed -i "s|<CHANGE_CAUSE>|${imageTag}|g" manifests/k8s.yaml
          sed -i "s|<IMAGE>|${image}|g" manifests/k8s.yaml
          sed -i "s|<IMAGE_TAG>|${imageTag}|g" manifests/k8s.yaml
          sed -i "s|<INGRESS>|${INGRESS}|g" manifests/k8s.yaml
          kubectl --kubeconfig $kubeconfig apply -f manifests/k8s.yaml -n ${NAMESPACE}
          '''
        }
      }
    }

    stage('RollOut') {
      environment {
        kubeconfig = credentials('kubeconfig')
      }
      input {
        id 'ROLLOUT'
        message "是否快速回滚？"
        ok "确认"
        submitter ""
        parameters {
          choice(name: 'UNDO', choices: ['NO', 'YES'], description: '是否快速回滚？')
        }
      }
      steps {
        container('kubectl') {
          echo "Kubernetes快速回滚"
          script {
            if ("${UNDO}" == 'YES') {
              sh "kubectl --kubeconfig ${kubeconfig} rollout undo deployment consume-deployment -n ${NAMESPACE}"
            }
          }
        }
      }
    }
  }
}
```

### Ref
- https://www.jenkins.io/doc/book/pipeline/syntax/
- https://github.com/jenkinsci/kubernetes-plugin/tree/master/examples/declarative_from_yaml_file
- https://plugins.jenkins.io/kubernetes/
- http://blog.jboost.cn/k8s3-cd.html
- https://plugins.jenkins.io/git-parameter/