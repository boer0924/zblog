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
Jenkins流水线是一套插件，它支持实现和集成持续交付流水线到Jenkins。

Jenkinsfile: 创建一个检入到源码管理系统中的`Jenkinsfile`带来了一些直接的好处：
1. 流水线上的代码评审/迭代
2. 对流水线进行审计跟踪
3. 流水线的单一可信数据源，能够被项目的多个成员查看和编辑
流水线支持 两种语法：声明式（在 Pipeline 2.5 引入）和脚本式流水线。

<!-- more -->

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
    hostName: jenkins.meitianiot.lo
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
- ##### 添加`代码仓库`凭证
![key-gitea](/img/jenkins_key_gitea.jpg)
- ##### 添加Harbor Registry凭证
1. 方法同添加`代码仓库`凭证
2. 注意将公用账户加入**每一个项目**的成员，并赋予**项目管理员**以上权限。[参考](/2019/09/09/k8s-registry-harbor/#%E5%88%9B%E5%BB%BARegistry-secret)
- ##### 添加kubeconfig凭证
![key-kubeconfig](/img/jenkins_key_kubeconfig.jpg)

### KubernetesPod.yaml
**划重点**
- maven缓存.m2
- docker in docker
- jnlp容器必须有，command不能覆盖jenkins-slave
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
- 定义agent label是为在k8s中调度job的pod名字
- 定义parameters来选择需要部署的环境。即namespace
- Jenkinsfile的两个全局变量：env/params。
  - 设置env变量: env.KEY = value
  - 使用env变量: ${KEY}
- username&password凭证的使用: registryCre = credentials('registry') [_USR/_PSW]
  - 获取username: ${registryCre_USR}
  - 获取passowrd: ${registryCre_PSW}
- 使用short commit_id作为image_tag 和 kubernetes.io/change-cause, 以保证镜像唯一，和可以回退到指定版本。
- sed动态修改k8s资源定义文件manifests/k8s.yaml：
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