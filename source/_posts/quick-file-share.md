---
title: 快速文件共享分发的几个方式
date: 2018-03-29 16:16:16
index_img: https://picsum.photos/300/200.webp?share
tags:
  - Golang
  - Python
  - FileZilla
  - SimpleHTTPServer
categories: DevOps
---
在办公环境下和同事之间互传文件是再正常不过的需求了，但当微信、企业微信等工具文件传输功能被限制的时候，问题就变的棘手。
下面分享几个小方法来互传分享文件。

<!-- more -->

### 1、FileZilla
传统FTP方式，推荐FileZilla工具，既有服务端(Windows only)，又有客户端(All platforms)。

### 2、Python
注意python2和python3不同的模块，默认监听在`Serving HTTP on 0.0.0.0 port 8000`

##### python2
`python -m SimpleHTTPServer`

##### python3
`python -m http.server`
### 3、Golang
```go
package main

import (
	"flag"
	"fmt"
	"net/http"
)

func main() {
	var d = flag.String("d", ".", "指定需要代理的文件目录")
	flag.Parse()
	h := http.FileServer(http.Dir(*d))
	fmt.Println("Serving HTTP on 0.0.0.0 port 10924 (http://0.0.0.0:10924/) ...")
	http.ListenAndServe(":10924", h)
}
```
> 使用：
1. Build: `go build ghttp.go`
2. Help: `./ghttp.exe -h`
3. Demo: `./ghttp.exe -d E:/workspaces/daily`