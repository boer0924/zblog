---
title: Golang - Go语言中的嵌入【第二部分】：接口嵌入接口
date: 2023-03-15 17:10:18
index_img: https://picsum.photos/300/200.webp?interface
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg008.jpg
sticky: 210
tags:
  - Go
  - Golang
categories: Golang
---
Go 语言并不支持传统意义上的继承，相反，它提倡通过组合来扩展类型的功能。这并不是 Go 所特有的概念，继承之上的组合是 OOP 的一个众所周知的原则，在《设计模式》一书的第一章就有介绍。Embedding(嵌入)是 Go 语言一个重要的特性，有了它使得组合更加方便、更有用。虽然 Go 力求简单，但某种程度上嵌入增加了语言的复杂度，如果使用不当会导致 bug 出现。在这一系列文章中，我将介绍 Go 支持的不同种类的嵌入，并提供真实的代码示例(大部分来自 Go 语言的标准库)。

<!-- more -->

这篇文章是介绍 Go 语言支持的各种嵌入方式的系列文章的第二部分：

*   结构体嵌入结构体[(第一部分)](/2023/03/15/golang-structs-in-structs/)；
    
*   接口嵌入接口[(第二部分)](/2023/03/15/golang-interfaces-in-interfaces/)；
    
*   接口嵌入结构体[(第三部分)](/2023/03/15/golang-interfaces-in-structs/)；
    

### 接口嵌入接口

在一个接口里面嵌入另一个接口，是 Go 语言里最简单的一种嵌入方式，因为接口只定义了抽象能力，并没有为类型定义新的数据和行为。

我们先看 Effective Go\[1\] 里列的示例，一个众所周知的 Go 标准库中嵌入接口的示例，给出 io.Reader 和 io.Writer 接口:

```
type Reader interface {
    Read(p []byte) (n int, err error)
}
type Writer interface {
    Write(p []byte) (n int, err error)
}
```


那该如何定义个接口，它既是 reader 又是 writer 呢？一种常见的方法像下面这样做：

```
type ReadWriter interface {
    Read(p []byte) (n int, err error)
    Write(p []byte) (n int, err error)
}

```


除了在多个地方重复声明相同的方法，这一明显的问题之外，这种方式还降低了 ReadWriter 的可读性，因为它并没有利用组合的方式使得代码更简洁。

注意，Go 标准库中有很多类似这样的接口组合，比如：io.ReadCloser、io.WriteCloser、io.ReadWriteCloser、io.ReadSeeker、io.WriteSeeker、io.ReadWriteSeeker，其他包里面还有很多类似接口。

如果这些接口 Read 方法都重新声明的话，那恐怕得声明 10 次以上，这是很糟糕的，所幸的是接口组合可以完美地解决这个问题：

```
type ReadWriter interface {
  Reader
  Writer
}

```


除了避免重复声明之外，这种方式还有一个特别明显的含义，为了实现 ReadWriter，必须先实现 Reader 和 Writer。

### 修复 Go1.14 里面一个接口方法覆盖的 bug

正如你期望的那样，嵌入接口是可以组合的，例如，给定接口 A、B、C 和 D：

```
type A interface {
  Amethod()
}
type B interface {
  A
  Bmethod()
}
type C interface {
  Cmethod()
}
type D interface {
  B
  C
  Dmethod()
}
```


接口 D 的方法结合包括：Amethod()、Bmethod()、Cmethod() 和 Dmethod()。

然而，接入接口 C 定义成下面这样：

```
type C interface {
  A
  Cmethod()
}

```


按道理来说，这种定义方式不会改变 D 的方法集合。然而，在 Go1.14 版本之前，接口 D 会导致一个错误：“Duplicate method Amethod”，因为 Amethod 方法被重复声明了两次，一次是在接口 B 声明，一次是在接口 C 里声明。

Go1.14 已经修改了这个 bug\[2\]，接口 D 的方法集包括：所有子接口的方法集和其自身的方法。

一个来自 Go 语言标准库的实际例子，io.ReadWriteCloser 接口是这样定义的：

```
type ReadWriteCloser interface {
  Reader
  Writer
  Closer
}

```


但是它可以用下面这种更简洁的方式来定义：

```
type ReadWriteCloser interface {
  io.ReadCloser
  io.WriteCloser
}

```


在 Go 1.14 之前，这种定义方式是不可行的，因为 io.ReadCloser 和 io.WriteCloser 都定义了 Close() 方法。

### 示例：net.Error

net 包有声明自己的错误接口：

```
// An Error represents a network error.
type Error interface {
  error
  Timeout() bool   // Is the error a timeout?
  Temporary() bool // Is the error temporary?
}

```


可以看到，Error 内嵌了 error 接口，这种嵌入方式表明，net.Error 也是一个 error，读代码的人一眼就能看出这点，而不需要去看 Error 的方法声明。

### 示例：heap.Interface

heap 包有如下的接口声明：

```
type Interface interface {
  sort.Interface
  Push(x interface{}) // add x as element Len()
  Pop() interface{}   // remove and return element Len() - 1.
}

```


实现了 heap.Interface 接口的类型必定实现了 sort.Interface 接口，后者包括三个方法，如果不使用嵌入方式，代码就像下面这样：

```
type Interface interface {
  Len() int
  Less(i, j int) bool
  Swap(i, j int)
  Push(x interface{}) // add x as element Len()
  Pop() interface{}   // remove and return element Len() - 1.
}

```


这样一对比，嵌入式版本的写法无疑是更优的，最重要的是，可以让人一眼就能明白要想实现 heap.Interface 接口必须先实现 sort.Interface 接口。

> via: https://eli.thegreenplace.net/2020/embedding-in-go-part-2-interfaces-in-interfaces/  
> 作者：Eli Bendersky  

### 参考资料

\[1\] Effective Go: https://go.dev/doc/effective_go#embedding

\[2\] bug: https://github.com/golang/proposal/blob/master/design/6977-overlapping-interfaces.md