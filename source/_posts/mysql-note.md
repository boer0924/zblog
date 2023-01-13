---
title: MySQL运维笔记
date: 2021-05-20 10:30:16
index_img: https://picsum.photos/300/200.webp?mysql
tags:
  - MySQL
categories: SRE
---
我的MySQL运维笔记

<!-- more -->

### MySQL备份恢复
```bash
## MySQL客户端必须软件包
# https://downloads.mysql.com/archives/community/
curl -LO https://cdn.mysql.com/archives/mysql-5.7/mysql-community-client-5.7.26-1.el7.x86_64.rpm
curl -LO https://cdn.mysql.com/archives/mysql-5.7/mysql-community-common-5.7.26-1.el7.x86_64.rpm
curl -LO https://cdn.mysql.com/archives/mysql-5.7/mysql-community-libs-5.7.26-1.el7.x86_64.rpm
curl -LO https://cdn.mysql.com/archives/mysql-5.7/mysql-community-libs-compat-5.7.26-1.el7.x86_64.rpm

mysql-community-client
mysql-community-common
mysql-community-libs
mysql-community-libs-compat

# mysql login-path登录信息
mysql_config_editor set --host=mysql.boer.xyz --login-path=dev-mysql --password --user=boer --port=3306
mysql_config_editor print --all
mysql_config_editor print --login-path=dev-mysql
mysql_config_editor remove --login-path=dev-mysql
cat ~/.mylogin.cnf

# dump
mysqldump --login-path=dev-mysql --default-character-set=utf8 --set-gtid-purged=OFF --single-transaction bwi_task > /backup/bwi_task.$(date +%Y-%m-%d).sql

# set mysql var. speed up recovery
mysql --login-path=dev-mysql << EOF
set global innodb_flush_log_at_trx_commit = 0;
set global sync_binlog = 2000;
EOF

# restore
mysql --login-path=dev-mysql bwi_task_sub < /backup/bwi_task.$(date +%Y-%m-%d).sql

# reset mysql var.
mysql --login-path=dev-mysql << EOF
set global innodb_flush_log_at_trx_commit = 1;
set global sync_binlog = 1;
EOF

echo "finish time at: $(date +%Y-%m-%d_%H:%M:%S)"
```

### 获取MySQL TOP10
```sql
SELECT
	TABLE_SCHEMA AS '数据库',
	TABLE_NAME AS '表名',
	TABLE_ROWS AS '记录数',
	TABLE_COMMENT AS '建表说明',
	TRUNCATE ( DATA_LENGTH / 1024 / 1024, 2 ) AS '数据容量(MB)',
	TRUNCATE ( INDEX_LENGTH / 1024 / 1024, 2 ) AS '索引容量(MB)' 
FROM
	information_schema.TABLES 
WHERE
	TABLE_SCHEMA = 'meisoodev' 
ORDER BY
	TABLE_ROWS DESC 
	LIMIT 10;
```

### useradd with passwd
```bash
openssl passwd -1 <password>
useradd -c 'DBA Account' -p '$1$MZKAIaY6$rqR264o5joCNsxp987NZD.' dbaops
# 卸载rpm不执行脚本
rpm -e --nopostun --nopreun x.rpm
```

### MySQL增量备份/同步 my2sql
```shell
outputs=$(MYSQL_PWD=Root_123 mysql -h 10.10.253.16 -s -u root << EOF
show master status;
EOF
)

# read history postion and binlog file.
history=$(cat .history.db)
his_binlog=$(echo $history | cut -d' ' -f1)
his_binpos=$(echo $history | cut -d' ' -f2)

# write current postion and binlog file.
echo $outputs > .history.db
binlog=$(echo $outputs | cut -d' ' -f1)
binpos=$(echo $outputs | cut -d' ' -f2)

# MYSQL_PWD=Root_123 mysqlbinlog -h 10.10.253.16 -d $db_name -R -u root --base64-output=decode-rows -v --start-position=$his_binpos --stop-position=$binpos $his_binlog $binlog > $db_name$his_binpos$binpos.sql

# my2sql tool parse binlog to sql
db_name=test
db_tables=all
# db_tables=order,common,payment
my2sql -user root -password Root_123 -host 10.10.253.16 -port 3306 -databases $db_name -work-type 2sql -start-file $his_binlog -stop-file $binlog -start-pos $his_binpos -stop-pos $binpos -output-dir sql -do-not-add-prifixDb
# >/dev/null 2>&1
echo "binlog parse ok..."

# import target database.
MYSQL_PWD=Root_123 mysql -h 10.10.253.16 -s -u root testbus < sql/forward.3.sql
echo "increment restore ok..."
```