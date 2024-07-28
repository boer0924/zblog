---
title: Office2021LTSC版本安装激活
date: 2024-07-24 21:56:18
index_img: https://picsum.photos/300/200.webp?office
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg002.jpg
tags:
  - Office
categories: DevOps
---
GVLKs for KMS and Active Directory-based activation of Office, Project, and Visio
https://learn.microsoft.com/zh-cn/office/volume-license-activation/gvlks

<!-- more -->

Office Deployment Tool
https://www.microsoft.com/en-us/download/details.aspx?id=49117

Office 自定义工具
https://config.office.com/deploymentsettings > 保存到C:\Users\boer\Downloads\office\config.xml

cd C:\Users\boer\Downloads\office
下载
setup /download config.xml
配置安装
setup /configure config.xml

如果以上步骤未激活，二次激活方法如下：
cd C:\Program Files\Microsoft Office\Office16
cscript ospp.vbs /sethst:kms.03k.org
cscript ospp.vbs /act