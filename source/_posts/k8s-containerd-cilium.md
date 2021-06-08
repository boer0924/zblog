---
title: Kubernetes新技术研究
date: 2021-05-20 16:16:16
index_img: https://picsum.photos/300/200.webp?cilium
sticky: 100
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
kubeadm config print init-defaults

--skip-phases=addon/kube-proxy;