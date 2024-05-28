---
title: Golang - 语言中的嵌入【第一部分】：结构体嵌入结构体
date: 2023-03-15 17:06:08
index_img: https://picsum.photos/300/200.webp?struct
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg008.jpg
sticky: 200
tags:
  - Golang
categories: Golang
---
Go 语言并不支持传统意义上的继承，相反，它提倡通过组合来扩展类型的功能。这并不是 Go 所特有的概念，继承之上的组合是 OOP 的一个众所周知的原则，在《设计模式》一书的第一章就有介绍。Embedding(嵌入)是 Go 语言一个重要的特性，有了它使得组合更加方便、更有用。虽然 Go 力求简单，但某种程度上嵌入增加了语言的复杂度，如果使用不当会导致 bug 出现。在这一系列文章中，我将介绍 Go 支持的不同种类的嵌入，并提供真实的代码示例(大部分来自 Go 语言的标准库)。

<!-- more -->

Go 语言里面有三种不同类型的嵌入：

*   结构体嵌入结构体[(第一部分)](/2023/03/15/golang-structs-in-structs/)；
    
*   接口嵌入接口[(第二部分)](/2023/03/15/golang-interfaces-in-interfaces/)；
    
*   接口嵌入结构体[(第三部分)](/2023/03/15/golang-interfaces-in-structs/)；
    

### 结构体嵌入结构体

我们将从一个简单的示例开始，演示将一个结构体嵌入另一个结构体：

```
type Base struct {
  b int
}
type Container struct {     // Container 是嵌入结构体
  Base                      // Base 是被嵌入的结构体
  c string
}
```


【译者注】为了便于理解，被嵌入的结构体我们称为内部类型；嵌入结构体称为外部类型。

Container 的实例现在也会有 b 字段，在 Go 语言规范中，它被称为一个提升(promoted)字段，我们可以像访问成员 c 那样访问它。

```
co := Container{}
co.b = 1
co.c = "string"
fmt.Printf("co -> {b: %v, c: %v}\n", co.b, co.c)

```


然而，当使用结构体字面量时，我们需要将被嵌入的结构体整体初始化，而不是单单对其字段初始化。

```
co := Container{Base: Base{b: 10}, c: "foo"}
fmt.Printf("co -> {b: %v, c: %v}\n", co.b, co.c)

```


我们可以这样 co.Base.b 访问 b，co.b 是一种简介的访问方式，

### 方法

上面的机制同样适用于带有方法的结构体。假设 Base 有一个可用的方法：

```
func (base Base) Describe() string {
  return fmt.Sprintf("base %d belongs to us", base.b)
}

```


我们仍然可以通过 Container 实例调用该方法，就好像 Container 拥有该方法一样：

```
fmt.Println(cc.Describe())

```


为了更好地理解这个调用的机制，我们可以想象 Container 有一个明确的 Base 类型的字段和一个明确的 Describe 方法来转发这个调用。

```
type Container struct {
  base Base
  c string
}
func (cont Container) Describe() string {
  return cont.base.Describe()
}
```


这种方式与之前的调用方式是同样的效果。

### 被嵌入的字段被覆盖

当内部类型和外部类型都有一个字段 x，嵌入时会发生什么呢？这种情况下，通过嵌入结构访问 x 时，我们访问到的是外部类型的 x，而不是内部类型的 x：

```
type Base struct {
  b   int
  tag string
}
func (base Base) DescribeTag() string {
  return fmt.Sprintf("Base tag is %s", base.tag)
}
type Container struct {
  Base
  c   string
  tag string
}
func (co Container) DescribeTag() string {
  return fmt.Sprintf("Container tag is %s", co.tag)
}
```


像下面这样使用：

```
b := Base{b: 10, tag: "b's tag"}
co := Container{Base: b, c: "foo", tag: "co's tag"}
fmt.Println(b.DescribeTag())
fmt.Println(co.DescribeTag())
```


输出：

```
Base tag is b's tag
Container tag is co's tag

```


注意，当我们访问 co.tag 时，我们访问的是 Container 的 tag 字段，而不是 base 的 tag 字段。我们可以通过 co.Base.tag 方式访问 base 的 tag 字段。

下面几个例子都来自 Go 语言的标准库。

### 示例：sync.Mutex

Go 语言里结构体嵌入的一个经典例子是 sync.Mutex，比如 crypto/tls/common.go 文件中的 lruSessionCache：

```
type lruSessionCache struct {
  sync.Mutex
  m        map[string]*list.Element
  q        *list.List
  capacity int
}

```


注意这里的嵌入结构体 sync.Mutex，如果 cache 是 lruSessionCache 的实例，我们可以直接调用方法 cache.Lock() 和 cache.Unlock()，这在一些场景下非常有用。如果 lock 是结构体的公共 API 的一部分，嵌入 mutex 会很方便，而且不需要额外地转发方法。

不过，也有可能是该结构体的内部方法中使用该锁，并没有对外公开。在这种情况下，我不会嵌入 sync.Mutex，而是让它成为一个未导出的字段(如 mu sync.Mutex)。

### 示例：elf.FileHeader

结构体中嵌入 sync.Mutex 是一个很好的示例，外部类型可以获得新的行为能力，比如加锁、解锁。这里有一个不同的例子，关于数据嵌入。在 debug/elf/file.go中，我们找到描述 ELF 文件的结构:

```
// A FileHeader represents an ELF file header.
type FileHeader struct {
  Class      Class
  Data       Data
  Version    Version
  OSABI      OSABI
  ABIVersion uint8
  ByteOrder  binary.ByteOrder
  Type       Type
  Machine    Machine
  Entry      uint64
}
// A File represents an open ELF file.
type File struct {
  FileHeader
  Sections  []*Section
  Progs     []*Prog
  closer    io.Closer
  gnuNeed   []verneed
  gnuVersym []byte
}
```


elf 包的开发者直接在 File 结构体中列出了所有的文件头字段，但是将这些字段归纳在 FileHeader 结构体中，这是一个很好的数据分区的示例。写代码的人可能会想要单独初始化或者操作文件头，而这种嵌入式的结构设计可以很好地做到这点。

我们可以在文件 compress/gzip/gunzip.go 中找到另一个相同的例子，gzip.Reader 嵌入了 gzip.Header 结构体，这是一个非常好的嵌入数据重用的例子，因为 gzip.Writer 也嵌入了 gzip.Header，所以这有助于避免重复拷贝。

### 示例：bufio.ReadWriter

由于嵌入结构体（外部类型）“继承”了被嵌入结构体的方法，所以嵌入结构体可以成为实现接口的一个有用工具。

我们可以看看 bufio 包，里面有一个 bufio.Reader 类型，`*bufio.Reader` 类型实现了 io.Reader 接口，同样地 `*bufio.Writer` 实现了 io.Writer 接口。那我们该如何创建一个实现了 io.ReadWriter 接口的类型呢？

通过嵌入可以很容易实现：

```
type ReadWriter struct {
  *Reader
  *Writer
}

```


类型“继承”了 `*bufio.Reader` 和 `*bufio.Writer` 的所有方法，所以实现了 io.ReadWriter 接口，不需要额外地命名其他字段，也不需要明确地转发方法，就能轻松地实现。

另一个类似的例子，context 包里面的 timerCtx 结构体：

```
type timerCtx struct {
  cancelCtx
  timer *time.Timer
  deadline time.Time
}
```


为了实现 Context 接口，timerCtx 结构体嵌入了 cancelCtx，它已经实现了 4 个方法中的 3 个方法：Done()、Err() 和 Value()，所以 timerCtx 只需要实现属于自己的 Deadline() 方法即可。

> via: https://eli.thegreenplace.net/2020/embedding-in-go-part-1-structs-in-structs/  
> 作者：Eli Bendersky