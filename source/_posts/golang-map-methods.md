---
title: Golang - 对比Python-Dict之Map
date: 2017-08-24 16:16:16
index_img: https://picsum.photos/300/200.webp?map
tags:
  - Golang
  - Go
  - map
  - hash
categories: Golang
---
接上文`slice`方法，本文对比python中的`dict`实现`map`的方法

文末有`彩蛋`，送道面试题，请在评论区附上你的答案...

<!-- more -->

- dict.clear() 删除字典中所有元素
- dict.copy() 返回字典(浅复制)的一个副本
- dict.get(key,default=None) 对字典dict中的键key,返回它对应的值value，如果字典中不存在此键，则返回default 的值(注意，参数- default 的默认值为None)
- dict.has_key(key) 如果键(key)在字典中存在，返回True，否则返回False
- dict.items() 返回一个包含字典中(键, 值)对元组的列表
- dict.keys() 返回一个包含字典中键的列表
- dict.values() 返回一个包含字典中所有值的列表
- dict.pop(key[, default]) 和方法get()相似，如果字典中key 键存在，删除并返回dict[key]，如果key 键不存在，且没有给出default 的值，引发KeyError 异常。

### clear()方法
```go
func clear(ms map[string]interface{}) map[string]interface{} {
	// // Method - I , say book is name of map
	// for k := range book {
	// 	delete(book, k)
	// }

	// // Method - II
	// book = make(map[string]int)

	// // Method - III
	// book = map[string]int{}
	ms = make(map[string]interface{})
	return ms
}
```

### copy()方法
```go
func copy(dst, src map[string]interface{}) map[string]interface{} {
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
```

### haskey()方法
```go
func haskey(ms map[string]interface{}, key string) bool {
	for k := range ms {
		if k == key {
			return true
		}
	}
	return false
}
```

### keys()方法
```go
func keys(ms map[string]interface{}) []string {
	var keys = []string{}
	for k := range ms {
		keys = append(keys, k)
	}
	return keys
}
```

### values()方法
```go
func values(ms map[string]interface{}) []interface{} {
	var values = []interface{}{}
	for _, v := range ms {
		values = append(values, v)
	}
	return values
}
```
### pop()方法
```go
func pop(ms map[string]interface{}, key string) interface{} {
	v := ms[key]
	if v != nil {
		delete(ms, key)
	}
	return v
}
```

## 彩蛋
```go
func calc(x, y int) int {
	fmt.Println(x, y, x+y)
	return x + y
}
func run() {
	a := 1
	b := 2
	defer calc(a, calc(a, b))
	a = 0
	defer calc(a, calc(a, b))
}
```