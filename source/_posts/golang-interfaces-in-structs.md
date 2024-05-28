---
title: Golang - 语言中的嵌入【第三部分】：接口嵌入结构体
date: 2023-03-15 17:30:36
index_img: https://picsum.photos/300/200.webp?iis
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg008.jpg
sticky: 220
tags:
  - Golang
categories: Golang
---
Go 语言并不支持传统意义上的继承，相反，它提倡通过组合来扩展类型的功能。这并不是 Go 所特有的概念，继承之上的组合是 OOP 的一个众所周知的原则，在《设计模式》一书的第一章就有介绍。Embedding(嵌入)是 Go 语言一个重要的特性，有了它使得组合更加方便、更有用。虽然 Go 力求简单，但某种程度上嵌入增加了语言的复杂度，如果使用不当会导致 bug 出现。在这一系列文章中，我将介绍 Go 支持的不同种类的嵌入，并提供真实的代码示例(大部分来自 Go 语言的标准库)。

<!-- more -->

这篇文章是介绍 Go 语言支持的各种嵌入方式的系列文章的第三部分：

*   结构体嵌入结构体[(第一部分)](/2023/03/15/golang-structs-in-structs/)；
    
*   接口嵌入接口[(第二部分)](/2023/03/15/golang-interfaces-in-interfaces/)；
    
*   接口嵌入结构体[(第三部分)](/2023/03/15/golang-interfaces-in-structs/)；
    

### 结构体中嵌入接口

第一眼看上去，这是 Go 语言支持的最令人困惑的嵌入方式。我们并不能立马知道结构体中嵌入接口意味着什么。在这篇文章中，我们将慢慢研究该技术点，并介绍几个实际场景中的例子。文章看完之后，你会看到底层的机制其实很简单，而且这个功能在各种场景中非常有用。

我们先从一个简单的例子开始：

```
type Fooer interface {
  Foo() string
}
type Container struct {
  Fooer
}
```


Fooer 是一个接口，被嵌入到结构体 Container 中。回顾下第一篇文章，我们知道嵌入的结构体会自动获得被嵌入结构体的方法。对于接口来说，也是同样的道理。我们可以这样认为，结构体 Container 有这样一个转发的方法：

```
func (cont Container) Foo() string {
  return cont.Fooer.Foo()
}

```


但是这里的 cont.Fooer 指的是什么呢？它是任何实现了 Fooer 接口的对象。那这个对象从哪里来呢？当初始化 Container 时，分配给 Fooer 字段的。看下这个例子：

```
// sink takes a value implementing the Fooer interface.
func sink(f Fooer) {
  fmt.Println("sink:", f.Foo())
}
// TheRealFoo is a type that implements the Fooer interface.
type TheRealFoo struct {
}
func (trf TheRealFoo) Foo() string {
  return "TheRealFoo Foo"
}
```


现在我们可以这样操作：

```
co := Container{Fooer: TheRealFoo{}}
sink(co)

```


执行程序将会输出：

```
sink: TheRealFoo Foo.

```


发生了什么，这里的机制是怎么样的？注意看，Container 是怎样被初始化的，字段 Fooer 被赋了一个 TheRealFoo 类型的值。我们可以将任何实现了 Fooer 接口的类型的值赋值给 Fooer，其他类型的值的话会编译不通过。因为 Fooer 接口嵌入到 Container，所以 Container 自动获得了 TheRealFoo 的方法，这使得 Container 也实现了接口 Fooer。这就是为什么可以将 Container 的值传递给 sink。如果没有嵌入，sink(co) 将会编译报错，因为 co 没有实现 Fooer。

可能你会好奇假设 Container 结构体的 Fooer 字段没有被初始化会发生什么？这是个很好的问题。如果是这样的话，会出现的情况可能和你预想的差不多，字段 Fooer 的默认值是 nil，看下面的代码：

```
co := Container{}
sink(co)

```


将会报错：

```
runtime error: invalid memory address or nil pointer dereference

```


上面介绍了接口嵌入结构体的工作机制，现在有一个更重要的问题：我们为什么需要怎么做？下面我将介绍介个来自 Go 语言标准库的例子，但是我会先介绍一个其他示例，并展示这个知识点在日常编写客户端代码的重要用途。

### 示例：接口包装器

这个例子来自 GitHub 用户 valyala，摘自评论\[1\]。

假设我们想给一个 socket 连接添加一些额外的功能，比如计算读取的字节数，我们可以定义如下的结构：

```
type StatsConn struct {
  net.Conn
  BytesRead uint64
}
```


StatsConn 实现了接口 net.Conn，所以它可以在任何需要 net.Conn 的地方使用。我们可以使用实现了 net.Conn 接口的类型的任何值来初始化 StatsConn，它会“继承”该类型的所有方法，关键是，我们可以重新实现自己想要的方法。就比如这个例子，我们重新实现了 Read 方法，记录读取的字节数：

```
func (sc *StatsConn) Read(p []byte) (int, error) {
  n, err := sc.Conn.Read(p)
  sc.BytesRead += uint64(n)
  return n, err
}

```


对 StatsConn 的使用者来说，我们仍然可以在这个方法中调用 sc.Conn.Read() 方法，也可以做一些额外的工作，比如将记录读取的字节数。

从上一节我们知道，正确地初始化 StatsConn 就至关重要，比如：

```
conn, err := net.Dial("tcp", u.Host+":80")
if err != nil {
  log.Fatal(err)
}
sconn := &StatsConn{conn, 0}

```


上面的代码中 net.Dial 的返回值实现了接口 net.Conn，所以我们可以用它来初始化 StatsConn。

我们可以将变量 sconn 传递给参数是 net.Conn 的任何函数，比如：

```
resp, err := ioutil.ReadAll(sconn)
if err != nil {
  log.Fatal(err)
}

```


这样的话，接着我们可以访问 BytesRead 字段获取读取的字节数。

这是一个接口包装器的例子。我们创建了一个新的类型，实现了一个现有的接口，但重新使用了一个嵌入的值来实现了大部分的功能。我们也可以通过一个显示的 conn 字段来实现这一点，就像下面这样：

```
type StatsConn struct {
  conn net.Conn
  BytesRead uint64
}
```


然后为 net.Conn 接口中的每个方法编写转发方法，例如：

```
func (sc *StatsConn) Close() error {
  return sc.conn.Close()
}

```


但是 ner.Conn 接口有 8 个方法，给所有这些方法写转发方法是乏味且没有必要的。嵌入接口可以避免这点，我们只需要重写想要实现的那些方法即可。

### 示例：sort.Reverse

接口嵌入结构体在 Go 语言标准库中的一个经典例子就是 sort.Reverse。它的用法常常让刚学习 Go 语言的新手感到困惑，因为根本不清楚它是机制是怎样的。

我们先从一个简单的排序例子开始，对整型的切片排序：

```
lst := []int{4, 5, 2, 8, 1, 9, 3}
sort.Sort(sort.IntSlice(lst))
fmt.Println(lst)

```


输出 \[1 2 3 4 5 8 9\]。这段代码的实现原理是怎样的呢？sort.Sort() 函数接收一个实现 sort.Interface 接口的参数，该接口定义如下：

```
type Interface interface {
    // Len is the number of elements in the collection.
    Len() int
    // Less reports whether the element with
    // index i should sort before the element with index j.
    Less(i, j int) bool
    // Swap swaps the elements with indexes i and j.
    Swap(i, j int)
}

```


如果我们有一个想要使用 sort.Sort() 来排序的类型，那该类型就必须实现该接口。对于像整型切片这样的简单类型，标准库提供了类型转换 sort.IntSlice，该类型是实现了接口 sort.Interface，所以上面那段代码可以执行。

那 sort.Reverse 的工作机制是怎样的呢？它通过巧妙地将接口嵌入结构体，sort 包有一个的未导出的类型来实现这点：

```
type reverse struct {
  sort.Interface
}
func (r reverse) Less(i, j int) bool {
  return r.Interface.Less(j, i)
}
```


到这里应该很好理解了，reverse 通过嵌入的方式实现了接口 sort.Interface (前提是用一个已经实现接口 sort.Interface 的类型的值初始化)，它重写了其中一个方法 -- Less()。在 Less() 方法里，将参数调换顺序，然后调用了 sort.Interface 的 Less() 方法，实现参数的反转。

实现参数反转的 sort.Reverse 也很简单：

```
func Reverse(data sort.Interface) sort.Interface {
  return &reverse{data}
}

```


所以我们可以这样做：

```
sort.Sort(sort.Reverse(sort.IntSlice(lst)))
fmt.Println(lst)

```


程序输出：\[9 8 5 4 3 2 1\]

这里需要理解的关键点是，调用 sort.Reverse 函数本身不会执行排序或者反转的操作，它其实可以看做是一个高阶函数：包装了一个接口类型的值并且在 Less() 方法里调整了功能，实际的排序操作发生在调用 sort.Sort 的时候。

### 示例：context.WithValue

context 包里有一个 WithValue 函数：

```
func WithValue(parent Context, key, val interface{}) Context

```


该函数返回一个父 context 的备份，并携带键值对 key-val。我们一起来看下底层机制是怎样的。

忽略错误检查，WithValue 主要代码如下：

```
func WithValue(parent Context, key, val interface{}) Context {
  return &valueCtx{parent, key, val}
}

```


valueCtx 结构体如下：

```
type valueCtx struct {
  Context
  key, val interface{}
}

```


看，这又是一个接口嵌入结构体的例子。valueCtx 实现了 Context 接口，可以重写其中的方法，实际上它只重写了 Value():

```
func (c *valueCtx) Value(key interface{}) interface{} {
  if c.key == key {
    return c.val
  }
  return c.Context.Value(key)
}

```


### 示例：使用受限制的接口降低结构体的功能

这是个有点进阶的知识点，但是在标准库的很多地方都有使用。尽管这样，我也不认为在编写代码时需要普遍使用，所以如果你刚入门 Go 语言，可以不用接着往下看，不用太担心。当你积累了更多 Go 语言方面的经验再来看也不迟。

我们先来看下 io.ReaderFrom 接口：

```
type ReaderFrom interface {
    ReadFrom(r Reader) (n int64, err error)
}

```


实现了这个接口的类型可以从 io.Reader 读取数据。例如，`*os.File`类型实现了该接口，可以从 io.Reader 读取数据并存放在打开的文件里。我们看下是怎么实现的：

```
func (f *File) ReadFrom(r io.Reader) (n int64, err error) {
  if err := f.checkValid("write"); err != nil {
    return 0, err
  }
  n, handled, e := f.readFrom(r)
  if !handled {
    return genericReadFrom(f, r)
  }
  return n, f.wrapErr("write", e)
}

```


首先尝试使用 readFrom 方法从 r 读取数据，底层与操作系统相关。例如，在 Linux 上，它使用 copy\_file\_range 系统调用在两个文件之间进行非常快速的复制，直接在内核中进行。

readFrom 会返回 bool 值(handled)，表示读取是否成功。如果不成功，ReadFrom 会调用 genericReadFrom 函数，如下：

```
func genericReadFrom(f *File, r io.Reader) (int64, error) {
  return io.Copy(onlyWriter{f}, r)
}

```


它使用 io.Copy 从 r 复制到 f，到目前为止看起来还不错。但是 f 为什么要使用 onlyWriter 包装下呢？

```
type onlyWriter struct {
  io.Writer
}

```


有趣吧，这就是我们熟悉的接口嵌入结构体。但是找遍整个文件，没有看到 onlyWriter 定义任何方法，也就是说没实现任何功能。为什么会这样呢？

要理解问什么，我们需要看看 io.Copy 的代码，它的代码有点长就不贴出来了。但是关键点要注意到如果 dst 参数实现了接口 io.ReaderFrom，它就会调用 ReadFrom，这样就回到了刚才调用 genericReadFrom 地方，这就形成了循环调用了！

现在，为什么需要 onlyWriter 变得很好理解了。将 f 包装起来作为参数调用 io.Copy，该参数的类型(即 onlyWriter)没有实现接口 io.ReaderFrom，但是实现了 io.Writer 接口，所以，它会去调用 File 的 Write 方法，这样就避免了 ReadFrom 的无限循环调用。

正如我之前提到过的，这种使用方法比较高级。我觉得有必要强调一下，因为这实际上是一种不同寻常的用法，而且在整个标准库中普遍使用。

这里有一点还比较好，显式地命名了 onlyWriter 类型，有助于我们理解它是干什么的。标准库中的一些代码是直接使用匿名结构体的，比如在 tar 包里面：

```
io.Copy(struct{ io.Writer }{sw}, r)

```


> via: https://eli.thegreenplace.net/2020/embedding-in-go-part-3-interfaces-in-structs/  
> 作者：Eli Bendersky  

### 参考资料

\[1\] 评论: https://github.com/golang/go/issues/22013#issuecomment-331886875