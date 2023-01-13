---
title: 那些年，拉取Docker镜像犯的困
date: 2018-09-15 16:16:16
index_img: https://picsum.photos/300/200.webp?docker
tags:
  - Docker
  - DockerHub
categories: DevOps
---
曾多少次，你在拉取Docker镜像时出现Timeout
曾几何时，你想在没有Docker客户端的情况下拉取Docker镜像
又有多少回，即使你有梯子也翻不过`GCR`, `Quay`等镜像仓库的墙...

<!-- more -->

以下，我们列举几种拉取镜像的场景并给出解决方法
1. 安装K8S集群时
2. Docker客户端拉取时
3. 无需Docker客户端拉取镜像
4. 翻越`Quay`等镜像仓库的墙

### 1. K8S
> registry.aliyuncs.com/google_containers

```yaml
## kubeadm-config.yaml
# kubeadm init --config kubeadm-config.yaml --upload-certs
# kubeadm config print init-defaults
apiVersion: kubeadm.k8s.io/v1beta2
kind: ClusterConfiguration
kubernetesVersion: v1.18.3
controlPlaneEndpoint: k8s.meitianiot.lo:6443
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

### 2. Docker镜像加速
> https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors

```json
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

```

### 3. docker_pull.py 

> 无客户端拉取镜像 https://github.com/NotGlop/docker-drag
以下脚本只是站在巨人的肩膀上，加入了`proxies`功能，以应对中国局域网。

```python
import functools
import gzip
import hashlib
import json
import os
import shutil
import sys
import tarfile
from io import BytesIO

import requests
import urllib3

proxies = {
    'http': 'http://127.0.0.1:1081',
    'https': 'http://127.0.0.1:1081'
}

proxy_get = functools.partial(requests.get, proxies=proxies)

urllib3.disable_warnings()

if len(sys.argv) != 2:
    print('Usage:\n\tdocker_pull.py [registry/][repository/]image[:tag|@digest]\n')
    exit(1)

# Look for the Docker image to download
repo = 'library'
tag = 'latest'
imgparts = sys.argv[1].split('/')
try:
    img, tag = imgparts[-1].split('@')
except ValueError:
    try:
        img, tag = imgparts[-1].split(':')
    except ValueError:
        img = imgparts[-1]
# Docker client doesn't seem to consider the first element as a potential registry unless there is a '.' or ':'
if len(imgparts) > 1 and ('.' in imgparts[0] or ':' in imgparts[0]):
    registry = imgparts[0]
    repo = '/'.join(imgparts[1:-1])
else:
    registry = 'registry-1.docker.io'
    if len(imgparts[:-1]) != 0:
        repo = '/'.join(imgparts[:-1])
    else:
        repo = 'library'
repository = '{}/{}'.format(repo, img)

# Get Docker authentication endpoint when it is required
auth_url = 'https://auth.docker.io/token'
reg_service = 'registry.docker.io'
resp = proxy_get('https://{}/v2/'.format(registry), verify=False)
if resp.status_code == 401:
    auth_url = resp.headers['WWW-Authenticate'].split('"')[1]
    try:
        reg_service = resp.headers['WWW-Authenticate'].split('"')[3]
    except IndexError:
        reg_service = ""

# Get Docker token and fetch manifest v2 (this part is useless for unauthenticated registries like Microsoft)
resp = proxy_get('{}?service={}&scope=repository:{}:pull'.format(auth_url, reg_service, repository), verify=False)
access_token = resp.json()['token']
auth_head = {'Authorization': 'Bearer ' + access_token,
             'Accept': 'application/vnd.docker.distribution.manifest.v2+json'}

# Get image layer digests
resp = proxy_get('https://{}/v2/{}/manifests/{}'.format(registry, repository, tag), headers=auth_head, verify=False)
if (resp.status_code != 200):
    print('[-] Cannot fetch manifest for {} [HTTP {}]'.format(repository, resp.status_code))
    print(resp.content)
    auth_head = {'Authorization': 'Bearer ' + access_token,
                 'Accept': 'application/vnd.docker.distribution.manifest.list.v2+json'}
    resp = proxy_get('https://{}/v2/{}/manifests/{}'.format(registry, repository, tag), headers=auth_head,
                     verify=False)
    if (resp.status_code == 200):
        print('[+] Manifests found for this tag (use the @digest format to pull the corresponding image):')
        manifests = resp.json()['manifests']
        for manifest in manifests:
            for key, value in manifest["platform"].items():
                sys.stdout.write('{}: {}, '.format(key, value))
            print('digest: {}'.format(manifest["digest"]))
    exit(1)
layers = resp.json()['layers']

# Create tmp folder that will hold the image
imgdir = 'tmp_{}_{}'.format(img, tag.replace(':', '@'))
os.mkdir(imgdir)
print('Creating image structure in: ' + imgdir)

config = resp.json()['config']['digest']
confresp = proxy_get('https://{}/v2/{}/blobs/{}'.format(registry, repository, config), headers=auth_head,
                     verify=False)
file = open('{}/{}.json'.format(imgdir, config[7:]), 'wb')
file.write(confresp.content)
file.close()

content = [{
    'Config': config[7:] + '.json',
    'RepoTags': [],
    'Layers': []
}]
if len(imgparts[:-1]) != 0:
    content[0]['RepoTags'].append('/'.join(imgparts[:-1]) + '/' + img + ':' + tag)
else:
    content[0]['RepoTags'].append(img + ':' + tag)

empty_json = '{"created":"1970-01-01T00:00:00Z","container_config":{"Hostname":"","Domainname":"","User":"","AttachStdin":false, \
	"AttachStdout":false,"AttachStderr":false,"Tty":false,"OpenStdin":false, "StdinOnce":false,"Env":null,"Cmd":null,"Image":"", \
	"Volumes":null,"WorkingDir":"","Entrypoint":null,"OnBuild":null,"Labels":null}}'

# Build layer folders
parentid = ''
for layer in layers:
    ublob = layer['digest']
    # FIXME: Creating fake layer ID. Don't know how Docker generates it
    fake_layerid = hashlib.sha256((parentid + '\n' + ublob + '\n').encode('utf-8')).hexdigest()
    layerdir = imgdir + '/' + fake_layerid
    os.mkdir(layerdir)

    # Creating VERSION file
    file = open(layerdir + '/VERSION', 'w')
    file.write('1.0')
    file.close()

    # Creating layer.tar file
    sys.stdout.write(ublob[7:19] + ': Downloading...')
    sys.stdout.flush()
    bresp = proxy_get('https://{}/v2/{}/blobs/{}'.format(registry, repository, ublob), headers=auth_head,
                      verify=False)
    if (bresp.status_code != 200):
        bresp = proxy_get(layer['urls'][0], headers=auth_head, verify=False)
        if (bresp.status_code != 200):
            print('\rERROR: Cannot download layer {} [HTTP {}]'.format(ublob[7:19], bresp.status_code,
                                                                       bresp.headers['Content-Length']))
            print(bresp.content)
            exit(1)
    print("\r{}: Pull complete [{}]".format(ublob[7:19], bresp.headers['Content-Length']))
    content[0]['Layers'].append(fake_layerid + '/layer.tar')
    file = open(layerdir + '/layer.tar', "wb")
    mybuff = BytesIO(bresp.content)
    unzLayer = gzip.GzipFile(fileobj=mybuff)
    file.write(unzLayer.read())
    unzLayer.close()
    file.close()

    # Creating json file
    file = open(layerdir + '/json', 'w')
    # last layer = config manifest - history - rootfs
    if layers[-1]['digest'] == layer['digest']:
        # FIXME: json.loads() automatically converts to unicode, thus decoding values whereas Docker doesn't
        json_obj = json.loads(confresp.content)
        del json_obj['history']
        del json_obj['rootfs']
    else:  # other layers json are empty
        json_obj = json.loads(empty_json)
    json_obj['id'] = fake_layerid
    if parentid:
        json_obj['parent'] = parentid
    parentid = json_obj['id']
    file.write(json.dumps(json_obj))
    file.close()

file = open(imgdir + '/manifest.json', 'w')
file.write(json.dumps(content))
file.close()

if len(imgparts[:-1]) != 0:
    content = {'/'.join(imgparts[:-1]) + '/' + img: {tag: fake_layerid}}
else:  # when pulling only an img (without repo and registry)
    content = {img: {tag: fake_layerid}}
file = open(imgdir + '/repositories', 'w')
file.write(json.dumps(content))
file.close()

# Create image tar and clean tmp folder
docker_tar = repo.replace('/', '_') + '_' + img + '.tar'
tar = tarfile.open(docker_tar, "w")
tar.add(imgdir, arcname=os.path.sep)
tar.close()
shutil.rmtree(imgdir)
print('Docker image pulled: ' + docker_tar)
print('Compress the tar file with transport: tar -zcf ' + docker_tar + '.gz' + docker_tar)
print('Load the image: docker load -i ' + docker_tar)
```

### 4. Quay镜像
> 如：quay.mirrors.ustc.edu.cn
```bash
sed -i -e 's_quay.io_quay.mirrors.ustc.edu.cn_' manifests/*.yaml manifests/setup/*.yaml # quay.mirrors.ustc.edu.cn源
```