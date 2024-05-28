---
title: Golang - String/Bytes/Rune(字节-字符)
date: 2023-05-08 10:10:116
index_img: https://picsum.photos/300/200.webp?str
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
sticky: 100
tags:
  - Golang
  - Go
  - String
  - ASCII
  - Unicode
  - UTF-8
  - Rune
categories: Golang
---
In Go, a string is in effect a read-only slice of bytes. 

<!-- more -->

## Concepts

### ASCII
ASCII（American Standard Code for Information Interchange）是一种早期的字符编码标准，它最多只能支持128个字符，包括英文字母、数字、标点符号和一些控制字符。ASCII编码中，每个字符都对应一个7位或8位的二进制码。

### Unicode
Unicode是ASCII的后继者，它旨在支持世界上所有的文字。Unicode编码中，每个字符都对应一个唯一的码位（code point），即一个数字标识。Unicode编码可以支持超过10万个字符，包括各种语言的字母、符号、表意文字等。

---

ASCII只能支持有限的字符，而Unicode则能够支持更广泛的字符。在编码方式上，ASCII采用固定长度的编码，每个字符都对应一个7位或8位的二进制码，而Unicode则采用可变长度的编码，例如UTF-8、UTF-16和UTF-32等，每个字符的编码长度可以不同。

ASCII是Unicode的一个子集。Unicode的前128个码位与ASCII的编码完全相同，因此ASCII编码的文本可以直接在Unicode编码中使用，而不需要进行转换。
---

### UTF-8
UTF-8是一种Unicode编码方案，它使用可变长度的字节序列来表示Unicode字符。UTF-8的优点在于，它与ASCII兼容，并且可以有效地编码常见的字符。在UTF-8中，一个字符可以被编码为1到4个字节。Unicode编码还有其他的实现方式，例如UTF-16和UTF-32等。这些实现方式在编码方式和存储空间的利用上有所不同，适用于不同的场景和应用。

### Rune
rune是Go语言中的一个字符类型，它表示一个Unicode码位。在Go语言中，rune类型的变量可以存储任何一个Unicode字符。

### Characters
characters字符是人类使用的可视化符号，例如字母、数字、标点符号等。在UTF-8编码中，一个字符可以被编码为1到4个字节。【等同于Rune, for-Human】

### Bytes
bytes字节是计算机存储和处理信息的基本单位。在UTF-8编码中，一个字节表示8位二进制数据。

---

Code points, characters, and runes
到目前为止，我们在使用 "字节 "和 "字符 "这两个词时一直非常谨慎。这一方面是因为字符串包含字节，另一方面是因为 "字符 "这个概念有点难以定义。Unicode 标准使用 "码位 "一词来指单个值所代表的项目。代码点 U+2318，十六进制值为 2318，代表符号 ⌘ 。
> We’ve been very careful so far in how we use the words “byte” and “character”. That’s partly because strings hold bytes, and partly because the idea of “character” is a little hard to define. The Unicode standard uses the term “code point” to refer to the item represented by a single value. The code point U+2318, with hexadecimal value 2318, represents the symbol ⌘. 

## 跟着GPT理解String

```go
func Test_String(t *testing.T) {
	// 定义一个UTF-8编码的字符串
	s := "Hello, 世界"

	// 输出字符数
	t.Logf("Number of characters/runes: %d\n", utf8.RuneCountInString(s)) // 9
	// 输出字节数
	t.Logf("Number of bytes: %d\n", len(s)) // 13
}
```

### Q1. utf8.RuneCountInString("Hello, 世界")为什么等于9
utf8.RuneCountInString("Hello, 世界") 等于 9 的原因是字符串中的字符（rune）总数为 9。我们可以逐个分析字符串中的每个字符来解释这个结果。

首先，我们明确什么是字符（rune）。在 Go 语言中，rune 表示一个 Unicode 码点。因此，每个字符（无论是 ASCII 字符还是非 ASCII 字符）都被看作一个 rune。

让我们逐个字符来看：
1. H
2. e
3. l
4. l
5. o
6. ,（逗号）
7. （空格）
8. 世（汉字）
9. 界（汉字）

总共有 9 个字符（rune），因此 utf8.RuneCountInString("Hello, 世界") 返回 9 是正确的。

### Q2. len("Hello, 世界")为什么等于13
len("Hello, 世界") 等于 13 是因为 len 函数返回的是字符串的字节长度，而不是字符（rune）的数量。

在 UTF-8 编码中，不同的字符会占用不同数量的字节：

ASCII 字符（如 "Hello, " 中的字符）每个占用 1 个字节。
非 ASCII 字符（如 "世界" 中的汉字）每个通常占用 3 个字节。
我们可以逐个字符来看 Hello, 世界 中每个字符占用的字节数：

1. H        占 1 个字节
2. e        占 1 个字节
3. l        占 1 个字节
4. l        占 1 个字节
5. o        占 1 个字节
6. ,        占 1 个字节
7. （空格）  占 1 个字节
8. 世       占 3 个字节
9. 界       占 3 个字节
将这些字节数相加：

1 + 1 + 1 + 1 + 1 + 1 + 1 + 3 + 3 = 13

因此，len("Hello, 世界") 返回 13，因为这个字符串在 UTF-8 编码下的总字节数是 13。


### Q3. 当我在第 n 个位置对Go字符串进行索引时，为什么得不到第 n 个字符？
> “When I index a Go string at position n, why don’t I get the nth character?”

在 Go 语言中，当你对字符串进行索引时，你得到的是第 n 个字节而不是第 n 个字符（rune）。这是因为 Go 的字符串是以 UTF-8 编码的字节序列来存储的，而在 UTF-8 编码中，一个字符（rune）可以占用 1 到 4 个字节。

因此，直接使用索引操作符 (s[i]) 会给你第 i 个字节，而不是第 i 个字符。如果字符串包含非 ASCII 字符，这些字符会占用多个字节，所以简单的索引不能正确地访问这些字符。
如果你希望按字符（rune）进行索引，可以将字符串转换为 rune 切片，因为在 rune 切片中，每个元素都是一个字符（rune）。

```go
    s := "Hello, 世界"
    r := []rune(s)

    // 按字符（rune）进行索引
    fmt.Printf("第 1 个字符: %c\n", r[0]) // 输出 H
    fmt.Printf("第 8 个字符: %c\n", r[7]) // 输出 世
```

### Q4. for range "Hello, 世界"得到什么，为什么？
在 Go 语言中，使用 for range 循环遍历字符串时，它会按照字符（rune）进行遍历，而不是字节。这是因为 for range 会自动解码 UTF-8 字符串，并返回每个字符的 Unicode 码点和其在字符串中的起始字节位置。

让我们分析一下字符串 "Hello, 世界"：
```go
    s := "Hello, 世界"
    for i, c := range s {
        fmt.Printf("位置: %d, 字符: %c, Unicode: %U\n", i, c, c)
    }

// 位置: 0, 字符: H, Unicode: U+0048
// 位置: 1, 字符: e, Unicode: U+0065
// 位置: 2, 字符: l, Unicode: U+006C
// 位置: 3, 字符: l, Unicode: U+006C
// 位置: 4, 字符: o, Unicode: U+006F
// 位置: 5, 字符: ,, Unicode: U+002C
// 位置: 6, 字符:  , Unicode: U+0020
// 位置: 7, 字符: 世, Unicode: U+4E16
// 位置: 10, 字符: 界, Unicode: U+754C
```
分析这段输出：

对于 H、e、l、l、o、,、 ，每个字符都是一个 ASCII 字符，占用 1 个字节，位置是 0 到 6。
对于 世 和 界，每个字符是一个汉字，占用 3 个字节。世 开始于字节位置 7，界 开始于字节位置 10。
因此，for range 循环遍历字符串 "Hello, 世界" 时，它会：

按顺序返回每个字符的 Unicode 码点（rune）。
返回该字符在字符串中的起始字节位置。
这样可以正确处理多字节的 UTF-8 编码字符，而不仅仅是单字节的 ASCII 字符。

## 经验
**Avoid Using ‘len’ for String Length** 

Calculating the length of a string using the built-in ‘len’ function can be problematic when working with runes, as it counts bytes, not characters. Instead, use the ‘utf8.RuneCountInString’ function to count runes correctly.

## Ref
1. https://go.dev/blog/strings
2. https://medium.com/@golangda/golang-quick-reference-runes-2f3f117987a6
3. https://www.ascii-code.com
4. https://home.unicode.org
