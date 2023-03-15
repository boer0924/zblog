---
title: Go Modules
date: 2020-08-09 16:10:18
index_img: https://picsum.photos/300/200.webp?mod
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
sticky: 100
tags:
  - Go
categories: SRE
---
Go Modules是Go 1.11引入的新特性，它是 Go 语言的包管理工具，用于管理 Go 项目中的依赖关系。

<!-- more -->

### 自建仓库
[https://go.dev/ref/mod](https://go.dev/ref/mod)

```bash
go env -w GO111MODULE=on
go env -w GOPROXY=https://goproxy.cn,direct

go mod init code.boer.xyz/boerlabs/sm
go mod init code.boer.xyz/boerlabs/sm/v2
go mod tidy
go mod verify
go mod vendor

go clean -modcache

go run -mod=vendor main.go
go build -mod=verdor -o s2m main.go
go build -mod=mod -o s2m main.go # disable vendor
go build -o s2m main.go # disable vendor

go env -w GOFLAGS="-mod=vendor”

## 自建仓库作为go mod地址
# http仓库
go env -w GOINSECURE="code.boer.xyz"
# 私有仓库
go env -w GOPRIVATE="code.boer.xyz"
# GOPRIVATE变量是 低级别的 GONOPROXY 和 GONOSUMDB 变量的默认值
# go env -w GONOPROXY="code.boer.xyz"
# go env -w GONOSUMDB="code.boer.xyz"
```

### 导入本地包
> 或者更改其他开源库后，放在本地

[https://go.dev/doc/tutorial/call-module-code](https://go.dev/doc/tutorial/call-module-code)

```bash
<home>/
 |-- greetings/
 |-- hello/
# go mod edit -replace example.com/greetings=../greetings

module example.com/hello

go 1.16

require example.com/greetings

replace example.com/greetings => ../greetings

---

<home>/
 |-- greetings/
	 |-- hello/
# go mod edit -replace example.com/greetings=./greetings

module example.com/hello

go 1.16

require example.com/greetings

replace example.com/greetings => ./greetings
```

## VSCode use vendor
```bash
# 全局配置
go env -w GOFLAGS="-mod=vendor"
# 工作区配置
{
  "go.toolsEnvVars": {
    "GOFLAGS": "-mod=vendor"
  }
}
```