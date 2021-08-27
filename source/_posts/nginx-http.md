---
title: HTTP、WAF、Nginx
date: 2016-03-24 16:30:18
index_img: https://picsum.photos/300/200.webp?nginx-http
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - Nginx
  - Websocket
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

### vuejs nginx config
```conf
server {
  listen       80;
  server_name  www.boer.xyz;
  location / {
    root /home/www/html;
    index  index.html index.htm;
    try_files $uri $uri/ /index.html;
    if ($uri ~ .*\.(html|htm)$) {
      add_header Cache-Control no-cache;
      add_header X-Boer-Define love-boer;
    }
  }
  location ~ .*\.(html|htm)$ {
    root /home/www/html;
    add_header Cache-Control no-cache;
    add_header X-Boer-Define love-boer;
  }
}
```

### nginx json log
```
log_format json_combined escape=json
  '{'
    '"time_local":"$time_local",'
    '"remote_addr":"$remote_addr",'
    '"remote_user":"$remote_user",'
    '"request":"$request",'
    '"status": "$status",'
    '"body_bytes_sent":"$body_bytes_sent",'
    '"request_time":"$request_time",'
    '"http_referrer":"$http_referer",'
    '"http_user_agent":"$http_user_agent",'
    '"http_x_forwarded_for":"$http_x_forwarded_for"'
  '}';
access_log  /var/log/nginx/access.log  json_combined;
```

### backend http-ws,https-wss config
```conf
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
upstream backend {
    server 10.10.253.16:8090 weight=5;
}
server {
    listen       80;
    listen       443 ssl;
    server_name  waf.boer.xyz;

    ## http://nginx.org/en/docs/http/ngx_http_ssl_module.html
    ssl_certificate      /etc/nginx/ssl/waf.boer.xyz/cert.pem;
    ssl_certificate_key  /etc/nginx/ssl/waf.boer.xyz/key.pem;
    ssl_protocols        TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers          HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout  5m;
    ssl_session_cache shared:SSL:10m;

    access_log  /var/log/nginx/$server_name.access.log  json_combined;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}

; 1、打包地址 VUE_APP_PUBLIC_PATH = '/'
; 2、接口地址 VUE_APP_BASE_API = '//api.boer.xyz'
; 3、Websocket地址
; initWebSocket() {
;   let url = window.location.href
;   let wsuri;
;   if (url.indexOf('https://iot.boer.xyz') !== -1) {
;     wsuri = "wss://api.boer.xyz/inoutRecord/ws?userId=" + getUserId();
;   } else if (url.indexOf('http://iot.boer.xyz') !== -1) {
;     wsuri = "ws://api.boer.xyz/inoutRecord/ws?userId=" + getUserId();
;   }else {
;     wsuri = "ws://api.boer.xyz/inoutRecord/ws?userId=" + getUserId();
;   }
;   this.websock = new WebSocket(wsuri);
;   this.websock.onmessage = this.websocketonmessage;
;   this.websock.onopen = this.websocketonopen;
;   this.websock.onerror = this.websocketonerror;
;   this.websock.onclose = this.websocketclose;
; }
```
### Ref
- http://nginx.org/en/docs/http/ngx_http_core_module.html#location
- https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching
- https://github.com/loveshell/ngx_lua_waf
- https://github.com/unixhot/waf
- https://github.com/starjun/openstar/wiki