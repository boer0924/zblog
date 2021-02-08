---
title: 我的Windows终端
date: 2016-09-24 16:56:18
index_img: https://picsum.photos/300/200.webp?wt
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - Terminal
  - MSYS2
  - Oh-My-ZSH
categories: DevOps
---
Terminal - 工欲善其事，必先利其器

<!-- more -->

### 1、安装Windows Terminal
https://aka.ms/terminal

### 2、安装配置MSYS2
```bash
MSYS2是什么
https://www.msys2.org/wiki/How-does-MSYS2-differ-from-Cygwin/
# pacman 源配置
https://mirrors.tuna.tsinghua.edu.cn/help/msys2/
nano /etc/pacman.d/mirrorlist.mingw64
ctrl + x -> y/n
# 刷新软件包数据
pacman -Sy
# 安装必备软件包
pacman -S vim
pacman -S gcc
```

### 3、安装oh-my-zsh
```bash
# https://ohmyz.sh/#install
# 注意科学上网
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### 4、Windows Terminal集成MSYS2
```json
{
    "defaultProfile": "{2c4de342-38b7-51cf-b940-2309a0970924}",
    "copyOnSelect": true,
    "profiles":
    {
        "defaults":
        {
            // Put settings here that you want to apply to all profiles.
        },
        "list":
        [
            {
                "guid": "{2c4de342-38b7-51cf-b940-2309a0970924}",
                "name": "MSYS2",
                "padding": "0, 0, 0, 0",
                "snapOnInput": true,
                "closeOnExit": "graceful",
                "cursorShape": "filledBox",
                "commandline": "D:/msys64/msys2_shell.cmd -full-path -defterm -here -no-start -mingw64 -shell zsh",
                "icon": "D:/msys64/msys2.ico",
                "hidden": false
            }
        ]
    }
}
```
> 参数解析
D:/msys64/msys2_shell.cmd -full-path -defterm -here -no-start -mingw64 -shell zsh
- -full-path: Windows环境变量
- -shell: 指定启动shell
> 具体可以参考msys2安装目录下msys2_shell.cmd、msys2.ini两个文件
```

### 5、VSCode集成
```json
{
    "terminal.integrated.shell.windows": "D:/msys64/usr/bin/zsh.exe",
    "terminal.integrated.env.windows": {
        "MSYSTEM": "MINGW64",
        "CHERE_INVOKING": "1",
        "MSYS2_PATH_TYPE": "inherit"
    },
    "terminal.integrated.shellArgs.windows": [
        "-l",
        "-i"
    ],
}
# python虚拟环境在zsh环境下不能自动激活 @TODO
```

### 6、附录|参考
https://stackoverflow.com/questions/45404631/msys2-not-finding-windows-programs-despite-msys2-path-type-inherit
