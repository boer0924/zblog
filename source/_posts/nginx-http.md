---
title: Nginx配置与HTTP缓存
date: 2016-03-24 16:30:18
index_img: https://picsum.photos/300/200.webp?nginx-http
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - Nginx
categories: DevOps
---

Nginx $uri $request_uri $request_filename 与 location(root/alias)

<!-- more -->

```
浏览器请求 /scanQRCodePayPark/
$uri $request_uri $request_filename
/scanQRCodePayPark/index.html /scanQRCodePayPark/ /home/www/html/scanQRCodePayPark/index.html

浏览器请求 /scanQRCodePayPark/index.html
$uri $request_uri $request_filename
/scanQRCodePayPark/index.html /scanQRCodePayPark/index.html /home/www/html/scanQRCodePayPark/index.html

浏览器请求 /scanQRCodePayPark/?qs=123#/ # querystring 与 锚点Anchor
$uri $request_uri $request_filename
/scanQRCodePayPark/index.html /scanQRCodePayPark/?qs=123 /home/www/html/scanQRCodePayPark/index.html
```

```conf
http {
  server {
    listen       80;
    server_name  www.boer.xyz;
    root /home/www/html;
    location / {
      ssi  on;
      ssi_silent_errors on;
      index  index.html index.htm;
      if ($uri ~ .*\.(html|htm)$) {
        add_header Cache-Control no-cache;
        add_header X-Boer-Define love-boer;
      }
    }
    location ~ .*\.(html|htm)$ {
      add_header Cache-Control no-cache;
      add_header X-Boer-Define love-boer;
    }
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
      root   html;
    }
  }
  include /etc/nginx/conf.d/*.conf;
}
```

### Ref
- http://nginx.org/en/docs/http/ngx_http_core_module.html#location
- https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching