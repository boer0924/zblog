---
title: Golang/Python对比学习之Slice/List
date: 2017-08-18 16:16:16
index_img: https://picsum.photos/300/200.webp?s-l
tags:
  - Golang
  - Python
  - Slice
  - List
categories: Golang
---
Python中List列表的使用很方便, 内置电池插上就用, 堪比南孚聚能环

相比之下, Golang中Slice提供的内置方法就捉襟见肘了

然而, 习惯了Python动态语言提供的各种便利的内置方法, 对于Golang的静态语言, 自己实现这些方法反而不是那么信手拈来

下面我们通过对比Python来实现Golang中各个方法

<!-- more -->

方法汇总:
- `clear`
- `copy`
- `append`
- `extend`
- `pop`
- `index`
- `count`
- `insert`
- `remove`
- `reverse`/`reversed`
- `sort`/`sorted`
- `len`
- `max`/`min`
- `contains`
- `join`

### clear()方法
```go
func clear(lst []int) []int {
	return lst[:0]
}
var nums = []int{1, 2, 3, 4, 5}
nums = clear(nums)
log.Println(nums)
```
VS
```python
nums = [1, 2, 3, 4, 5]
nums.clear()
print(nums)
```

### copy()方法
```go
func myCopy(dst, src []int) int {
	return copy(dst, src)
}
```
```go
func myAppend(lst []int, el ...int) []int {
	return append(lst, el...)
}
```

func extend(dst, src []int) []int {
	return append(dst, src...)
}

func pop(lst []int) []int {
	return lst[:len(lst)-1]
}

func myPop(lst []int, i int) []int {
	return append(lst[:i], lst[i+1:]...)
}

func index(lst []int, el int) int {
	for i, v := range lst {
		if v == el {
			return i
		}
	}
	return -1
}

func count(lst []int, el int) int {
	maps := map[int]int{}
	for _, v := range lst {
		if v == el {
			maps[el]++
		}
	}
	return maps[el]
}

func insert(lst []int, el, i int) []int {
	lst = append(lst[:i+1], lst[i:]...)
	lst[i] = el
	return lst
}

func remove(lst []int, el int) []int {
	for i, v := range lst {
		if v == el {
			lst = append(lst[:i], lst[i+1:]...)
			break
		}
	}
	return lst
}

func reverse(lst []int) []int {
	tmp := make([]int, len(lst), cap(lst))
	for i := range lst {
		tmp[i] = lst[len(lst)-i-1]
	}
	return tmp
}

func mySort(lst []int) []int {
	// sort.Ints(lst)
	sort.Sort(sort.Reverse(sort.IntSlice(lst)))
	return lst
}

func myLen(lst []int) int {
	return len(lst)
}

func myMax(lst []int) int {
	t := lst[0]
	for _, v := range lst {
		if v > t {
			t = v
		}
	}
	return t
}

func myMin(lst []int) int {
	t := lst[0]
	for _, v := range lst {
		if v < t {
			t = v
		}
	}
	return t
}

```
```
```go
func contains(lst []int, el int) bool {
	for _, v := range lst {
		if v == el {
			return true
		}
	}
	return false
}
```

```go
func join(nums []int) string {	
	var numsText = []string{}
	for _, n := range nums {
		text := strconv.Itoa(n)
		numsText = append(numsText, text)
	}
	res := strings.Join(numsText, "+")
	return res
}
```