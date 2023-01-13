---
title: Golang - 切片逆序遍历的几种方法
date: 2017-08-16 16:16:16
index_img: https://picsum.photos/300/200.webp?slice
tags:
  - Golang
  - Go
  - Slice
  - reverse
categories: Golang
---
本文记录几种`slice`遍历的方法，涉及知识点有：`slice`, `for`, `range`, `defer`, `闭包(closure)`, `channel`

<!-- more -->

```go
// main.go
package main

import "fmt"

func main() {
	t()
}

func t() {
	var nums = []int{1, 2, 3, 4, 5}
	// 顺序1
	for _, n := range nums {
		fmt.Println(n)
	}
	// 顺序2, 一般不这样吧
	for i := 0; i < len(nums); i++ {
		fmt.Println(nums[i])
	}

	// 逆序1, 普通程序员
	for i := len(nums) - 1; i >= 0; i-- {
		fmt.Println(nums[i])
	}
	// 逆序2, nice简洁、赞
	for i := range nums {
		fmt.Println(nums[len(nums)-i-1])
	}
	// 逆序3, channel实现
	for n := range reverse(nums) {
		fmt.Println(n)
	}
	// 逆序4, defer实现, 不是一般程序员
	for _, n := range nums {
		defer fmt.Println(n)
	}
}

func reverse(lst []int) chan int {
	ret := make(chan int)
	go func() {
		for i := range lst {
			ret <- lst[len(lst)-1-i]
		}
		close(ret)
	}()
	return ret
}
```