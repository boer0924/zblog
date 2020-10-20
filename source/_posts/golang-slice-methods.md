---
title: Golang - 对比Python-List之Slice
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
fmt.Println(nums)
// []
```
VS
```python
L = [1,2,3,4]
L.clear()
print(L)
# []
```

### copy()方法
```go
func myCopy(dst, src []int) int {
	return copy(dst, src)
}
var nums = []int{1, 2, 3, 4, 5}
var mums = make([]int, len(nums), cap(nums))
_ = myCopy(mums, nums)
fmt.Println(mums)
// [1 2 3 4 5]
```
VS
```python
L1 = [1,2,3,4]
L2 = L1.copy()
print(L2)
# [1,2,3,4]
```

### append()方法
```go
func myAppend(lst []int, el ...int) []int {
	return append(lst, el...)
}
var nums = []int{1, 2, 3, 4, 5}
nums = myAppend(nums, 6, 7, 8)
fmt.Println(nums)
// [1 2 3 4 5 6 7 8]
```
VS
```python
L = [1,2,3]
L.append(4)
print(L)
# [1, 2, 3, 4]
L.appned([5, 6])
print(L)
# [1, 2, 3, 4, [5, 6]]
```

### extend()方法
```go
func extend(dst, src []int) []int {
	return append(dst, src...)
}
var nums = []int{1, 2, 3, 4, 5}
fmt.Printf("%v, %v, %v, %p\n", nums, len(nums), cap(nums), nums)
var mums = []int{6, 7, 8}
nums = extend(nums, mums)
fmt.Println(nums)
fmt.Printf("%v, %v, %v, %p\n", nums, len(nums), cap(nums), nums)
// [1 2 3 4 5], 5, 5, 0xc0000b4090
// [1 2 3 4 5 6 7 8]
// [1 2 3 4 5 6 7 8], 8, 10, 0xc0000a40f0
// !!! 注意两次打印Slice的len, cap, 内存地址的不同。
// 这也说明了Slice与Array的对应关系: 
// 当前Array不能满足Slice容量时，会重新分配内存空间并复制数据
```
VS
```python
L = [1,2,3]
A = [4,5,6]
L.extend(A)
print(L)
# [1,2,3,4,5,6]
# !!! 该方法返回值为None，修改的是原列表
```

### pop()方法
```go
func pop(lst []int) []int {
	return lst[:len(lst)-1]
}
var nums = []int{1, 2, 3, 4, 5}
nums = pop(nums)
fmt.Println(nums)
// [1 2 3 4]

func myPop(lst []int, i int) []int {
	return append(lst[:i], lst[i+1:]...)
}
var nums = []int{1, 2, 3, 4, 5}
nums = myPop(nums, 2)
fmt.Println(nums)
// [1 2 4 5]
```
VS
```python
L = [1, 2, 3, 4, 5]
print(L.pop())
# 5
print(L)
# [1,2,3,4]
L.pop(1)
print(L)
# [1,3,4]
```
### index()方法
```go
func index(lst []int, el int) int {
	for i, v := range lst {
		if v == el {
			return i
		}
	}
	return -1
}
```

### count()方法
```go
func count(lst []int, el int) int {
	maps := map[int]int{}
	for _, v := range lst {
		if v == el {
			maps[el]++
		}
	}
	return maps[el]
}
```

### insert()方法
```go
func insert(lst []int, el, i int) []int {
	lst = append(lst[:i+1], lst[i:]...)
	lst[i] = el
	return lst
}
```

### remove()方法
```go
func remove(lst []int, el int) []int {
	for i, v := range lst {
		if v == el {
			lst = append(lst[:i], lst[i+1:]...)
			break
		}
	}
	return lst
}
```

### reverse()方法
> [更多方法, 请参考...](/2017/08/16/golang-slice-reverse/)

```go
func reverse(lst []int) []int {
	tmp := make([]int, len(lst), cap(lst))
	for i := range lst {
		tmp[i] = lst[len(lst)-i-1]
	}
	return tmp
}
```

### sort()方法
```go
func mySort(lst []int) []int {
	// sort.Ints(lst)
	sort.Sort(sort.Reverse(sort.IntSlice(lst)))
	return lst
}
```

### len()方法
```go
func myLen(lst []int) int {
	return len(lst)
}
```

### max()方法
```go
func myMax(lst []int) int {
	t := lst[0]
	for _, v := range lst {
		if v > t {
			t = v
		}
	}
	return t
}
```
### Min()方法
```go
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

### contains()方法 -> 对比JAVA
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

### join()方法
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

### Ref
[Go Slices: usage and internals](https://blog.golang.org/slices-intro)
[python list中的方法和函数](https://www.jianshu.com/p/50da60d54a14)