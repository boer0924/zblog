---
title: Kubeadm部署HA Kubernetes集群
date: 2019-09-24 16:16:16
index_img: https://picsum.photos/300/200.webp?k8s
tags:
  - Kubernetes
  - Calico
  - IPVS
categories: DevOps
---
https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/

system requirement
2C2G

<!-- more -->

### 安装Aliyun YUM Repo
```bash
## https://developer.aliyun.com/mirror/

### base
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
curl -o /etc/yum.repos.d/CentOS-Base.repo https://mirrors.aliyun.com/repo/Centos-7.repo

### epel
mv /etc/yum.repos.d/epel.repo /etc/yum.repos.d/epel.repo.backup
mv /etc/yum.repos.d/epel-testing.repo /etc/yum.repos.d/epel-testing.repo.backup
wget -O /etc/yum.repos.d/epel.repo http://mirrors.aliyun.com/repo/epel-7.repo


# 安装必需软件
### https://github.com/opsnull/follow-me-install-kubernetes-cluster/blob/master/01.%E5%88%9D%E5%A7%8B%E5%8C%96%E7%B3%BB%E7%BB%9F%E5%92%8C%E5%85%A8%E5%B1%80%E5%8F%98%E9%87%8F.md
yum install -y chrony conntrack ipvsadm ipset jq iptables curl sysstat libseccomp wget socat git
```

### 优化内核参数
```bash
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables=1
net.bridge.bridge-nf-call-ip6tables=1
net.ipv4.ip_forward=1
net.ipv4.tcp_tw_recycle=0
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_timestamps=1
net.ipv4.neigh.default.gc_thresh1=1024
net.ipv4.neigh.default.gc_thresh2=2048
net.ipv4.neigh.default.gc_thresh3=4096
vm.swappiness=0
vm.overcommit_memory=1
vm.panic_on_oom=0
vm.max_map_count = 262144
fs.inotify.max_user_instances=8192
fs.inotify.max_user_watches=1048576
fs.file-max=52706963
fs.nr_open=52706963
net.ipv6.conf.all.disable_ipv6=1
net.netfilter.nf_conntrack_max=2310720
EOF
sysctl --system
```

### IPVS加载内核模块
```bash
## https://github.com/kubernetes/kubernetes/blob/master/pkg/proxy/ipvs/README.md

vim /etc/sysconfig/modules/ipvs.modules
#!/bin/bash
modprobe -- ip_vs
modprobe -- ip_vs_rr
modprobe -- ip_vs_wrr
modprobe -- ip_vs_sh
modprobe -- nf_conntrack_ipv4
```
> modprobe br_netfilter

### SELinux
```bash
setenforce 0
sed -i 's/^SELINUX=.*/SELINUX=disabled/' /etc/selinux/config
```

### 关闭 swap 分区
```bash
swapoff -a
sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### 设置iptables默认转发策略
```bash
systemctl stop firewalld
systemctl disable firewalld
iptables -F && iptables -X && iptables -F -t nat && iptables -X -t nat
iptables -P FORWARD ACCEPT
```

### 关闭无用服务
`systemctl stop postfix && systemctl disable postfix`

### 安装Aliyun YUM Repo
```bash
## https://developer.aliyun.com/mirror/
### k8s
cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg https://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
EOF
```

### 安装kube* & docker
```bash
yum install -y kubelet kubeadm kubectl # 注意版本需要和镜像版本对应
systemctl enable kubelet && systemctl start kubelet

yum install -y yum-utils device-mapper-persistent-data lvm2
yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

# https://docs.docker.com/engine/install/centos/

yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine

yum update -y && yum install -y \
  containerd.io-1.2.13 \
  docker-ce-19.03.8 \
  docker-ce-cli-19.03.8
mkdir /etc/docker
# 镜像加速  https://cr.console.aliyun.com/cn-beijing/instances/mirrors
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["https://890une7x.mirror.aliyuncs.com"],
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
EOF
mkdir -p /etc/systemd/system/docker.service.d
systemctl start docker.service
systemctl enable docker.service
systemctl status docker.service
```

### kubectl autocompletion
`https://kubernetes.io/docs/tasks/tools/install-kubectl/#enabling-shell-autocompletion`


### kubeadm config
`vim kubeadm-config.yaml`
```yaml
# kubeadm init --config kubeadm-config.yaml --upload-certs
# kubeadm config print init-defaults
# https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/
apiVersion: kubeadm.k8s.io/v1beta2
kind: ClusterConfiguration
# https://storage.googleapis.com/kubernetes-release/release/stable.txt
# kubernetesVersion: stable
kubernetesVersion: v1.18.3
controlPlaneEndpoint: <your-lb-ip>:<port>
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
apiServer:
  timeoutForControlPlane: 4m0s
controllerManager: {}
scheduler: {}
imageRepository: registry.aliyuncs.com/google_containers
networking:
  dnsDomain: cluster.local
  podSubnet: 172.30.0.0/16
  serviceSubnet: 10.96.0.0/12
dns:
  type: CoreDNS
etcd:
  local:
    dataDir: /var/lib/etcd
---
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
mode: ipvs
```

### kubeadm deploy
```bash
kubeadm init --config kubeadm-config.yaml --upload-certs
kubeadm config images pull --config kubeadm-config.yaml # 先拉取镜像
curl -LO https://docs.projectcalico.org/v3.14/manifests/calico.yaml
# 更改CALICO_IPV4POOL_CIDR 为podSubnet: 172.30.0.0/16
# - name: CALICO_IPV4POOL_CIDR
#   value: "172.30.0.0/16"
# 更改为BGP模式 https://docs.projectcalico.org/reference/node/configuration
# Enable IPIP
# - name: CALICO_IPV4POOL_IPIP
#   value: "Never"
kubectl apply -f calico.yaml

# core-dns pod不再pending

kubeadm reset
kubectl delete node <node-name>
```

### ipvs重建
```bash
# 如果安装时为iptables模式
kubectl -n kube-system edit cm kube-proxy
# mode: "ipvs"
kubectl get pod -n kube-system | grep kube-proxy | awk '{system("kubectl delete pod "$1" -n kube-system")}' # 重建kube-proxy的pod
```

### Calico BGP模式重建
```bash
# https://docs.projectcalico.org/archive/v3.14/getting-started/kubernetes/installation/config-options
curl -LO https://docs.projectcalico.org/v3.14/manifests/calico.yaml
# 更改CALICO_IPV4POOL_CIDR 为podSubnet: 172.30.0.0/16
# - name: CALICO_IPV4POOL_CIDR
#   value: "172.30.0.0/16"
# 更改为BGP模式 https://docs.projectcalico.org/reference/node/configuration
# Enable IPIP
# - name: CALICO_IPV4POOL_IPIP
#   value: "Never"
kubectl apply -f calico.yaml
```

### Operations
```bash
## 切换默认namespace
kubectl config set-context $(kubectl config current-context) --namespace=<insert-namespace-name-here>
# Validate it
kubectl config view | grep namespace

# create registry secret
kubectl create secret docker-registry boer-harbor --docker-server=harbor.boer.xyz --docker-username=admin --docker-password=Admin@123 --docker-email=boer0924@gmail.com --namespace=boer-public

kubectl drain $NODENAME
kubectl uncordon $NODENAME

docker ps --format "{{.ID}}\t{{.Command}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "status=exited"
```

#### etcdctl
```bash
# https://jimmysong.io/kubernetes-handbook/guide/using-etcdctl-to-access-kubernetes-data.html
curl -LO etcd-v3.4.3-linux-amd64.tar.gz
alias etcdctl='etcdctl --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/peer.crt --key=/etc/kubernetes/pki/etcd/peer.key'
etcdctl get /registry/namespaces/kube-system -w=json | jq .
etcdctl member list
etcdctl help
# 备份
etcdctl snapshot save
etcdctl snapshot status
etcdctl snapshot restore
```

#### Calicoctl
```bash
# https://docs.projectcalico.org/archive/v3.14/getting-started/clis/calicoctl/
curl -O -L  https://github.com/projectcalico/calicoctl/releases/download/v3.14.1/calicoctl
mv calicoctl /usr/local/bin/
chmod a+x /usr/local/bin/calicoctl

vim /etc/calico/calicoctl.cfg
apiVersion: projectcalico.org/v3
kind: CalicoAPIConfig
metadata:
spec:
  datastoreType: "kubernetes"
  kubeconfig: "/root/.kube/config"

calicoctl get nodes
calicoctl node status # 查看calico运行模式
calicoctl get ipPool -o yaml
```

#### Helm v2安装
```bash
# https://qhh.me/2019/08/08/Helm-%E5%AE%89%E8%A3%85%E4%BD%BF%E7%94%A8/
curl -LO https://get.helm.sh/helm-v2.16.6-linux-amd64.tar.gz

vim rbac-config.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tiller
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tiller
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: tiller
    namespace: kube-system

helm init --service-account tiller -i registry.aliyuncs.com/google_containers/tiller:v2.16.6

helm repo list
helm repo add stable https://mirror.azure.cn/kubernetes/charts
helm repo add incubator https://mirror.azure.cn/kubernetes/charts-incubator

helm repo update
helm fetch stable/mysql # 当前目录现在xxx.tgz
helm install stable/mysql
```

### MetalLB
```bash
# 不让私有云用户成为K8S世界的二等公民
# https://metallb.universe.tf/installation/

# 用法demo
apiVersion: v1
kind: Service
metadata:
  name: theapp-service
  annotations:
    metallb.universe.tf/address-pool: default
  labels:
    app: theapp
spec:
  type: LoadBalancer
  # type: NodePort
  # type: ClusterIP
  ports:
  - port: 5000
    targetPort: 5000
    # nodePort: 31090
  selector:
    app: theapp

kubectl get svc # curl -v EXTERNAL-IP
```
MetalLB (头等舱)
![metallb](/img/figure/metallb.jpg)

<center>vs</center>

NodePort (经济舱)
![nodeport](/img/figure/nodeport.jpg)

### Ingress-Nginx L7
```bash
# https://kubernetes.github.io/ingress-nginx/deploy/#bare-metal
# 更改controller-service的type: LoadBalancer(默认NodePort)
# 添加MetalLB annotations
metadata:
  annotations:
    metallb.universe.tf/address-pool: default
spec:
  type: LoadBalancer

# 用法demo
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: theapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/load-balance: "ip_hash"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri"
spec:
  rules:
  - host: theapp.boer.xyz
    http:
      paths:
      - path: /
        backend:
          serviceName: theapp-service
          servicePort: 5000
```

### 安装Harbor在K8S之上
```bash
## https://www.qikqiak.com/post/harbor-quick-install/
~/k8s/charts
helm repo add harbor https://helm.goharbor.io
helm fetch harbor/harbor --version 1.3.2
tar -zxf harbor-1.3.2.tgz

vim harbor/values.yaml
expose:
  type: ingress
  tls:
    enabled: true
  ingress:
    hosts:
      core: registry.boer.xyz
      notary: notary.boer.xyz
    controller: default
    annotations:
      kubernetes.io/ingress.class: "nginx"
      ingress.kubernetes.io/ssl-redirect: "true"
      ingress.kubernetes.io/proxy-body-size: "0"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/proxy-body-size: "0"
externalURL: https://registry.boer.xyz
persistence:
  enabled: true
  resourcePolicy: "keep"
  persistentVolumeClaim:
    registry:
      storageClass: "openebs-hostpath"
    chartmuseum:
      storageClass: "openebs-hostpath"
    jobservice:
      storageClass: "openebs-hostpath"
    database:
      storageClass: "openebs-hostpath"
    redis:
      storageClass: "openebs-hostpath"
harborAdminPassword: "<your-secret-password>"

helm list
helm install --name harbor -f values.yaml . --namespace harbor
helm upgrade -f values.yaml harbor . --namespace harbor
helm delete --purge harbor
helm status harbor

kubectl -n harbor delete pvc $(kubectl -n harbor get pvc | grep harbor | awk '{print $1}')

kubectl get secret harbor-harbor-ingress -n kube-ops -o yaml
# 其中 data 区域中 ca.crt 对应的值就是我们需要证书，不过需要注意还需要做一个 base64 的解码，这样证书配置上以后就可以正常访问了。
# 保存data区域ca.crt内容到ca.crt
mkdir -p /etc/docker/certs.d/registry.boer.xyz
cp ca.crt /etc/docker/certs.d/registry.boer.xyz # 所有node均需配置
docker login registry.boer.xyz
docker tag mysql:5.7 registry.boer.xyz/public/mysql:5.7
docker push registry.boer.xyz/public/mysql:5.7

# hosts
ansible k8s -m lineinfile -a "dest=/etc/hosts line='10.10.253.17 registry.boer.xyz'"

kubectl create secret docker-registry boer-registry --docker-server=registry.boer.xyz --docker-username=deployer --docker-password=<your-password> --docker-email=boer0924@gmail.com --namespace=boer-public

# 用法demo
apiVersion: apps/v1
kind: Deployment
template:
  spec:
    containers:
    - name: theapp
      image: registry.boer.xyz/public/theapp:0.0.1
      imagePullPolicy: Always
      ports:
      - containerPort: 5000
    imagePullSecrets:
    - name: boer-registry
```

### 模型概览
![k8s-boer](/img/figure/k8s_network_outbound.jpg)

### Reference
- https://github.com/opsnull/follow-me-install-kubernetes-cluster
- https://my.oschina.net/baobao/blog/3031712
- https://kubernetes.io/zh/blog/2018/07/09/ipvs-based-in-cluster-load-balancing-deep-dive/