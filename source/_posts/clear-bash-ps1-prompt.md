---
title: 使终端提示符更清晰
date: 2015-08-24 15:56:18
index_img: https://picsum.photos/300/200.webp?ps1
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - PS1
  - Shell
  - Bash
  - Motd
categories: DevOps
---
作为一名运维工程师，很多时候Xshell会同时打开
- 运维环境
- 测试环境
- 生产环境

如果没有清晰、醒目的终端提示符，很容易在多个环境间来回切换误操作，导致生产事故等。

本着对生产环境的敬畏心，你也应该使终端提示符更清晰。

<!-- more -->

### 终端提示符

```bash
# https://ezprompt.net/
vim /etc/profile.d/ps1.sh

PS1="[\u@\[\e[31m\][生产]\[\e[m\]\h \w]\\$ "
PS1="[\u@\[\e[32m\][测试]\[\e[m\]\h \w]\\$ "
PS1="[\u@\[\e[33m\][预生产]\[\e[m\]\h \w]\\$ "
PS1="[\u@\[\e[34m\][运维]\[\e[m\]\h \w]\\$ "
PS1="[\u@\[\e[35m\][开发]\[\e[m\]\h \w]\\$ "

source /etc/profile.d/ps1.sh
```

### 登陆提示信息
```bash
# https://www.asciiart.eu/
vim /etc/motd

  _   _   _   _   _   _   _  
 / \ / \ / \ / \ / \ / \ / \ 
( W | e | l | c | o | m | e )
 \_/ \_/ \_/ \_/ \_/ \_/ \_/ 


```

### 引用参考
- https://ezprompt.net/
- https://www.asciiart.eu/
- http://www.network-science.de/ascii/