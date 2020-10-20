---
title: RPM包制作工具FPM介绍
date: 2016-07-07 16:16:16
index_img: https://picsum.photos/300/200.webp?fpm
tags:
  - RPM
  - FPM
categories: DevOps
---
本文记录rpm包制作工具[fpm](https://github.com/jordansissel/fpm)的使用笔记，分别记录了制作`filebeat`, `osquery`, `fastdfs`包的过程。

<!-- more -->

### filebeat7
```bash
# cd tmp_install;rpm2cpio ../filebeat-5.5.2-x86_64.rpm | cpio -div  # 解压rpm包
# -p NAME-VERSION-ARCH.rpm \

hostname Boer-RPM

fpm -s dir -t rpm -n boer-filebeat -v 7.1.1 \
--verbose --iteration 1 \
-m boer@boer.xyz \
--vendor "Boer RPM" \
--after-install after_install.sh \
-C tmp_install .

hostnamectl set-hostname VM_140_39

after_install.sh
IP=`ip -4 route get 8.8.8.8 | awk '{print $7}' | tr -d '\n'`
# IP=$(grep IPADDR /etc/sysconfig/network-scripts/ifcfg-bond?|cut -d '=' -f 2)
sed -i "s/ipv4address/$IP/" /etc/filebeat7/filebeat.yml
ver=`cat /etc/redhat-release`
if [[ $ver =~ "release 7" ]];then
  /usr/bin/systemctl daemon-reload
  /usr/bin/systemctl start filebeat7
  /usr/bin/systemctl enable filebeat7
else
  /sbin/chkconfig filebeat7 on
  service filebeat7 start
fi
```

### osquery
```bash
fpm -s dir -t rpm -n osquery -v 3.3.2 -m boer@boer.xyz \
-p NAME-VERSION-ARCH.rpm \
--after-install after_install.sh \
--after-remove after_remove.sh \
-C tmp_install \
.

after_install.sh
echo 'export PATH=$PATH:/opt/osquery/usr/bin #deltag:uuid:c99326b5-2b9d-401f-87fb-b3b7cedcf3d5' >> /etc/profile
source /etc/profile

after_remove.sh
rm -rf /opt/osquery
sed -i '/^export.*\#deltag:uuid:c99326b5-2b9d-401f-87fb-b3b7cedcf3d5/d' /etc/profile
source /etc/profile
```

### fastdfs
```bash
# libfastcommon
./make.sh
./make.sh install DESTDIR=../tmp_install
fpm -s dir -t rpm -n libfastcommon -v 1.0.7 -C tmp_install usr
# FastDFS
vim make.sh
DESTDIR=/srv/boer/fpm_rpm/fastdfs/FastDFS/tmp_install
./make.sh
./make.sh install
fpm -s dir -t rpm -n fastdfs -v 5.0.8 -d 'libfastcommon' -C tmp_install .
# nginx
./configure --prefix=/opt/nginx --sbin-path=/opt/nginx/sbin/nginx --conf-path=/opt/nginx/conf/nginx.conf --error-log-path=/home/finance/Logs/nginx/error.log --http-log-path=/home/finance/Logs/nginx/access.log --pid-path=/opt/nginx/var/nginx.pid --lock-path=/opt/nginx/var/nginx.lock --http-client-body-temp-path=/dev/shm/nginx_temp/client_body --http-proxy-temp-path=/dev/shm/nginx_temp/proxy --http-fastcgi-temp-path=/dev/shm/nginx_temp/fastcgi --user=finance --group=finance --with-cpu-opt=pentium4F --without-select_module --without-poll_module --with-http_realip_module --with-http_sub_module --with-http_gzip_static_module --with-http_stub_status_module --without-http_ssi_module --without-http_userid_module --without-http_ssi_module --without-http_userid_module --without-http_geo_module --without-http_map_module --without-mail_pop3_module --without-mail_imap_module --without-mail_smtp_module --with-http_ssl_module --add-module=../fastdfs-nginx-module/src
make
make install DESTDIR=/srv/boer/fpm_rpm/fastdfs/nginx-1.12.0/tmp_install
fpm -s dir -t rpm -n nginx-with-fastdfs -v 1.12.0 -C tmp_install .
```

### 编译安装
##### Q
```bash
./configure --prefix=***
make install --prefix=***
make install DESTDIR=***
```
##### A
Number 2 is simply an error as far as I know.

Number 1 determines where the package will go when it is installed, and where it will look for its associated files when it is run. It's what you should use if you're just compiling something for use on a single host.

Number 3 is for installing to a temporary directory which is not where the package will be run from. For example this is used when building deb packages. The person building the package doesn't actually install everything into its final place on his own system. He may have a different version installed already and not want to disturb it, or he may not even be root. So he uses configure --prefix=/usr so the program will expect to be installed in /usr when it runs, then make install DESTDIR=debian/tmp to actually create the directory structure.

### Ref
- https://github.com/jordansissel/fpm