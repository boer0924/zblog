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
# https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/
apiVersion: kubeadm.k8s.io/v1beta2
kind: ClusterConfiguration
# https://storage.googleapis.com/kubernetes-release/release/stable.txt
# kubernetesVersion: stable
kubernetesVersion: v1.18.3
controlPlaneEndpoint: <your-lb-ip>:<port>
# apiServer:
#   extraArgs:
#     anonymous-auth: "false"
# controllerManager:
#   extraArgs:
#     bind-address: 0.0.0.0
# scheduler:
#   extraArgs:
#     address: 0.0.0.0
imageRepository: registry.aliyuncs.com/google_containers
networking:
  dnsDomain: cluster.local
  podSubnet: 172.30.0.0/16
  serviceSubnet: 10.96.0.0/12
dns:
  type: CoreDNS
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

# TODO
## etcdctl

## Calicoctl
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
calicoctl node status
calicoctl get ipPool -o yaml

```

### Reference
- https://github.com/opsnull/follow-me-install-kubernetes-cluster
- https://my.oschina.net/baobao/blog/3031712
- https://kubernetes.io/zh/blog/2018/07/09/ipvs-based-in-cluster-load-balancing-deep-dive/