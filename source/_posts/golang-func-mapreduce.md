---
title: Golang - 对比Python高阶函数之MapReduce
date: 2017-08-30 16:16:16
index_img: https://picsum.photos/300/200.webp?mr
tags:
  - Golang
  - Go
  - MapReduce
categories: Golang
---
如果你读过Google的那篇大名鼎鼎的论文["MapReduce: Simplified Data Processing on Large Clusters"](https://research.google.com/archive/mapreduce-osdi04.pdf)，你就能大概明白map/reduce的概念。

<!-- more -->

![](https://for-boer-blog.oss-cn-beijing.aliyuncs.com/20201023172301.png?x-oss-process=style/blog-img-watermark)

### Map
```go
func maps(f func(int) int, nums []int) []int {
	var ret = make([]int, len(nums))
	for i, n := range nums {
		ret[i] = f(n)
	}
	return ret
}

func f(x int) int {
	return x + 2
}

var nums = []int{1, 2, 3, 4, 5}
fmt.Println(maps(f, nums))
// [3 4 5 6 7]
```
VS
```python
map(lambda x: x + 2, [1, 2, 3, 4, 5])
# 注意：在python3中map()函数返回map object，而非python2直接返回list对象
list(map(lambda x: x + 2, [1, 2, 3, 4, 5])) # 转为list
# 3, 4, 5, 6, 7
```

### Reduce
```go
func reduces(f func(x, y int) int, nums []int) int {
	var sum = 0
	for _, n := range nums {
		sum = f(sum, n)
	}
	return sum
}

func f1(x, y int) int {
	return x + y
}

func f2(x, y int) int {
	return x*10 + y
}

var nums = []int{1, 2, 3, 4, 5}
fmt.Println(reduces(f1, nums))
// 15
fmt.Println(reduces(f2, nums))
// 12345
```
VS
```python
from functools import reduce
# 注意：在python3中reduce()函数已经不再是内置函数，而是放到了functools包下面
reduce(lambda x, y: x + y, [1, 2, 3, 4, 5])
# 15
reduce(lambda x, y: x * 10 + y, [1, 2, 3, 4, 5])
# 12345
```

### Ref
- https://www.liaoxuefeng.com/wiki/1016959663602400/1017329367486080