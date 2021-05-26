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
