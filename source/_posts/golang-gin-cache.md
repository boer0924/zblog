---
title: Golang - Cache缓存使用示例
date: 2020-8-16 17:36:16
index_img: https://picsum.photos/300/200.webp?cache
tags:
  - Golang
  - Gin
  - Cache
categories: Golang
---
如何在一个 HTTP 服务器中使用缓存来提升性能，同时使用 sync.Once 和 Ticker 来实现了缓存的初始化和定时更新。

sync.Once 是 Go 标准库提供的使函数只执行一次的实现，常应用于单例模式，例如初始化配置、保持数据库连接等。

go-cache 是一个轻量级的基于内存的 K-V 储存组件，内部实现了一个线程安全的 map[string]interface{}，适用于单机应用。

<!-- more -->

go-cache 具备如下功能：
1. 线程安全，多 goroutine 并发安全访问；
2. 每个 item 可以设置过期时间（或无过期时间）
3. 自动定期清理过期的 item；
4. 可以自定义清理回调函数；

```go
package main

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
)

const (
	defaultExpireTime = 10 * time.Second
)

var (
	firstOnce  sync.Once
	secondOnce sync.Once
)

func NewCacheClient() *cache.Cache {
	var cacheWithTTL *cache.Cache
	firstOnce.Do(func() {
		cacheWithTTL = cache.New(5*time.Minute, 10*time.Minute)
	})
	return cacheWithTTL
}

func setDefaultCache(cacheClient *cache.Cache) {
	time.Sleep(1 * time.Second) // 模拟耗时操作，比如查询MySQL
	cacheClient.Set("foo", "balalala~"+time.Now().Format(time.RFC3339Nano), defaultExpireTime)
}

func main() {
	r := gin.Default()

	cacheClient := NewCacheClient()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// r.Use(authMiddleware())
	apiv1 := r.Group("/api/v1")
	{
		apiv1.GET("/go-cache", func(c *gin.Context) {
			secondOnce.Do(func() {
				setDefaultCache(cacheClient) // 初始化cache
				go func() {
					log.Printf("----debug----> %s \n", time.Now().Format(time.RFC3339))
					ticker := time.NewTicker(defaultExpireTime - 1*time.Microsecond)
					defer ticker.Stop()
					for {
						select {
						case <-ticker.C:
							setDefaultCache(cacheClient)
						case <-ctx.Done():
							return
						}
					}
				}()
			})
			foo, found := cacheClient.Get("foo")
			if !found {
				c.JSON(http.StatusOK, gin.H{
					"message": "cache not found",
				})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"message": foo,
			})
		})
	}
}
```
