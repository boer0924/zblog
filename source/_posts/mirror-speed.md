---
title: 各种镜像源加速
date: 2018-02-16 16:16:16
index_img: https://picsum.photos/300/200.webp?mirrors
tags:
  - pip
  - goproxy
  - npm
categories: DevOps
---
### 阿里云镜像站
`https://developer.aliyun.com/mirror/`

### python pip源
```bash
# python3 编译安装依赖
yum install zlib-devel libffi-devel openssl-devel

## https://pip.pypa.io/en/stable/user_guide/#config-file
# 全局生效
# Like-Unix(Linux)
vim /etc/pip.conf
# macOS
vim /Library/Application Support/pip/pip.conf
# Windows
notepad C:\ProgramData\pip\pip.ini
# https://developer.aliyun.com/mirror/pypi
## 阿里云源
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/

[install]
trusted-host=mirrors.aliyun.com
```

### Go proxy
```bash
## Go 1.13 及以上（推荐）
go env -w GO111MODULE=on
go env -w GOPROXY=https://goproxy.cn,direct
# go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct/
```

### NodeJS npm源
```bash
npm config set registry https://registry.npm.taobao.org
### 
npm config set <key> <value>
npm config get [<key>]
npm config delete <key>
npm config list [--json]
npm config edit
npm set <key> <value>
npm get [<key>]
```