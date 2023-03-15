---
title: Kubernetes新技术研究
date: 2021-05-20 16:16:16
index_img: https://picsum.photos/300/200.webp?cilium
tags:
  - Cilium
  - Containerd
categories: Kubernetes
---

eBPF 是我见过的 Linux 中最神奇的技术，没有之一，已成为 Linux 内核中顶级子模块，从 tcpdump 中用作网络包过滤的经典 cbpf，到成为通用 Linux 内核技术的 eBPF，已经完成华丽蜕变，为应用与神奇的内核打造了一座桥梁，在系统跟踪、观测、性能调优、安全和网络等领域发挥重要的角色。为 Service Mesh 打造了具备 API 感知和安全高效的容器网络方案 Cilium，其底层正是基于 eBPF 技术

-https://cloudnative.to/blog/bpf-intro/

<!-- more -->

# Containerd
cat <<EOF | tee /etc/modules-load.d/containerd.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

yum install -y yum-utils
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install containerd.io

mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
  ...
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
    SystemdCgroup = true

sed -i 's#k8s.gcr.io#registry.aliyuncs.com/google_containers#g' /etc/containerd/config.toml
sed -i 's#registry-1.docker.io#890une7x.mirror.aliyuncs.com#g' /etc/containerd/config.toml

systemctl restart containerd

# crictl 
https://kubernetes.io/zh/docs/tasks/debug-application-cluster/crictl/
https://github.com/kubernetes-sigs/cri-tools/tags
curl -L https://github.com/kubernetes-sigs/cri-tools/releases/download/v1.21.0/crictl-v1.21.0-linux-amd64.tar.gz -o crictl-v1.21.0-linux-amd64.tar.gz

cat << EOF | tee /etc/crictl.yaml
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
debug: false
EOF

# Cilium
https://docs.cilium.io/en/v1.10/concepts/kubernetes/requirements/#k8s-requirements

## 内核升级
# https://elrepo.org/tiki/HomePage
rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
yum install https://www.elrepo.org/elrepo-release-7.el7.elrepo.noarch.rpm
yum --enablerepo=elrepo-kernel install kernel-lt
kernel-lt is based on a "long term support" branch
kernel-ml is based on the "mainline stable" branch

#centos8不用更改内核启动顺序
#centos7的bios启动，选择第一个启动
grub2-set-default 0;grub2-mkconfig -o /boot/grub2/grub.cfg;
#centos7的efi启动，选择第一个启动
grub2-set-default 0;grub2-mkconfig -o /boot/efi/EFI/centos/grub.cfg;

## K8S初始化
yum install kubelet kubeadm kubectl containerd.io

### contained retag images
ctr -n k8s.io i pull registry.aliyuncs.com/google_containers/coredns:1.8.0
ctr -n k8s.io i tag registry.aliyuncs.com/google_containers/coredns:1.8.0 registry.aliyuncs.com/google_containers/coredns:v1.8.0

### 指定CoreDNS IP
helm repo add coredns https://coredns.github.io/helm
helm -n kube-system install coredns coredns/coredns --set service.clusterIP=10.96.0.10 service.name=kube-dns

kubeadm config print init-defaults
kubeadm --config init-defaults.yaml config images list
kubeadm --config init-defaults.yaml config images pull
```yaml
# https://kubernetes.io/zh/docs/setup/production-environment/tools/kubeadm/control-plane-flags/
# kubeadm init --config init-defaults.yaml --upload-certs
apiVersion: kubeadm.k8s.io/v1beta2
kind: InitConfiguration
nodeRegistration:
  criSocket: /var/run/containerd/containerd.sock
  name: node
  taints: null
---
apiVersion: kubeadm.k8s.io/v1beta2
kind: ClusterConfiguration
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
controllerManager: {}
dns:
  type: CoreDNS
etcd:
  local:
    dataDir: /var/lib/etcd
imageRepository: registry.aliyuncs.com/google_containers
kubernetesVersion: 1.21.2
networking:
  dnsDomain: cluster.local
  serviceSubnet: 10.96.0.0/12
scheduler: {}
---
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
mode: ipvs
```

kubeadm init --config init-defaults.yaml --upload-certs --skip-phases=addon/coredns
--skip-phases=addon/coredns
--skip-phases=addon/kube-proxy
--skip-phases=addon/kube-proxy,addon/coredns

### CA
```shell
openssl x509 -in ca.pem -out ca.crt
openssl rsa -in ca-key.pem -out ca.key

只在主节点上生成CA
bin/elasticsearch-certutil ca --days 36500
签发证书
bin/elasticsearch-certutil cert --ca elastic-stack-ca.p12 --days 36500
转换证书、验证有效期
openssl pkcs12 -in elastic-certificates.p12 -out elastic-certificates.pem -nodes
openssl x509 -in elastic-certificates.pem -noout -dates

mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

kubeadm join 10.10.253.16:6443 --token 8gntrw.collopy8yolzmxzu \
	--discovery-token-ca-cert-hash sha256:3b6ceec33bc3d99ce5f2dd157eed51c7cd010e48948a71068e4a63fece02a1b4

vim /var/lib/kubelet/kubeadm-flags.env
KUBELET_KUBEADM_ARGS="--container-runtime=remote --container-runtime-endpoint=/var/run/containerd/containerd.sock --pod-infra-container-image=registry.aliyuncs.com/google_containers/pause:3.4.1"

# ComponentStatus
kubectl get cs
/etc/kubernetes/manifests/kube-scheduler.yaml
/etc/kubernetes/manifests/kube-controller-manager.yaml
# 删除这两个文件中命令选项中的- --port=0这行，重启kubelet

yum install bash-completion
kubectl completion bash >/etc/bash_completion.d/kubectl
helm completion bash > /etc/bash_completion.d/helm
curl -L https://raw.githubusercontent.com/containerd/containerd/main/contrib/autocomplete/ctr -o /etc/bash_completion.d/ctr # ctr自动补全
```


iptables -F
iptables -X
iptables -L

ipvsadm --clear
ipvsadm -l

ctr -n k8s.io i rm $(ctr -n k8s.io i ls -q)
ctr -n k8s.io task kill -s SIGKILL $(ctr -n k8s.io task ls -q)
for t in $(ctr -n k8s.io task ls -q); do ctr -n k8s.io task kill -s SIGKILL $t; done
ctr -n k8s.io c rm $(ctr -n k8s.io c ls -q)


cilium install
cilium status
cilium hubble enable --ui