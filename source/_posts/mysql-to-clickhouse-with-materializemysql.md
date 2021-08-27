---
title: MySQL To ClickHouse数据实时同步引擎MaterializeMySQL
date: 2021-08-26 10:16:16
index_img: https://picsum.photos/300/200.webp?mms
sticky: 110
tags:
  - MySQL
  - ClickHouse
  - MaterializeMySQL
categories: BigData
---
- ClickHouse server version 21.7.2.7 (official build).
- MySQL 5.7.35
- Date 2021.8.25

<!-- more -->

### 一、数据同步
#### 1、MySQL配置
```conf
# vim custom_config.cnf
[mysqld]
log-bin=mysql-bin
binlog-format=ROW
max_binlog_size=10M # binlog文件大小
enforce-gtid-consistency=ON
gtid-mode=ON
server_id=1
```
#### 2、MySQL存储过程模拟数据
```sql
/*
show databases;
create database if not exists testdb default character set utf8mb4 collate utf8mb4_unicode_ci;

select User,Host,plugin,authentication_string from mysql.user;
show global variables like 'validate_password%';
set global validate_password_length=9;
create user 'tester'@'%' identified with mysql_native_password by '54Ceshi@db';
set global validate_password_length=12;

grant all privileges on testdb.* to 'tester'@'%' with grant OPTION;
flush privileges;
show grants for tester@'%';

SMALLINT(6)  -32768 ~ 32767
SMALLINT(5) UNSIGNED  65535

INT(11)  -2147483648 ~ 2147483647
INT(10) UNSIGNED  4294967295

BIGINT(20)  -9223372036854775808 ~ 9223372036854775807
BIGINT(20) UNSIGNED  18446744073709551615
*/

USE testdb;
DROP TABLE IF EXISTS `tb_test`;
CREATE TABLE IF NOT EXISTS `tb_test` (
	`id`          BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键自增ID',
	`username`    VARCHAR(32) NOT NULL DEFAULT '' COMMENT '用户名' COLLATE 'utf8mb4_unicode_ci',
	`password`    VARCHAR(64) NOT NULL DEFAULT '' COMMENT '密码' COLLATE 'utf8mb4_unicode_ci',
	`phone`       VARCHAR(16) NULL DEFAULT '' COMMENT '手机号' COLLATE 'utf8mb4_unicode_ci',
	`email`       VARCHAR(32) NULL DEFAULT '' COMMENT '邮箱' COLLATE 'utf8mb4_unicode_ci',
	`gender`      SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '性别：0-保密（默认），1-男，2-女',
	`salary`      BIGINT(20) NOT NULL DEFAULT '0' COMMENT '薪水',
	`state`       SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '状态：0-禁用（默认），1-启用',
	`deleted`     SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '是否删除：0-否（默认），1-是',
	`create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
	`update_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
	`remark`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注' COLLATE 'utf8mb4_unicode_ci',
	PRIMARY KEY (`id`),
	UNIQUE INDEX `uq_username` (`username`),
	UNIQUE INDEX `uq_phone` (`phone`),
	UNIQUE INDEX `uq_email` (`email`),
	INDEX `ix_create_time` (`create_time`),
	INDEX `ix_update_time` (`update_time`)
)
COMMENT='测试表'
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=1
; 

delimiter ;
SET collation_connection='utf8mb4_unicode_ci';

drop procedure if exists proc_tb_test_data;

delimiter $$
CREATE definer=`tester`@`%` PROCEDURE proc_tb_test_data( IN input_total_num int(10), IN input_commit_num int(10) )
label_proc:BEGIN
    declare i int DEFAULT 1;
    declare row_total_num int DEFAULT 1;
    declare row_commit_num int DEFAULT 500;

    if (input_total_num>=input_commit_num and input_commit_num>0) then
        set row_total_num=input_total_num;
        set row_commit_num=input_commit_num;
    else
        leave label_proc;
    end if;

    start transaction;
    while i<=row_total_num do

INSERT INTO tb_test(username, password, phone, email, gender, salary, state, deleted)
SELECT 
    username,
    upper(MD5(username)) as password,
    phone,
    case 
        when email_type<=5 then CONCAT(username,'@gmail.com')
        when email_type>5 AND email_type<=15 then CONCAT(username,'@sina.cn')
        when email_type>15 AND email_type<=35 then CONCAT(username,'@sina.com')
        when email_type>35 AND email_type<=60 then CONCAT(username,'@163.com')
        else CONCAT(t.username,'@qq.com')
    end as email,
    gender,
    salary,
    state,
    case 
        when state=0 AND RAND()<0.1 then 1
        else 0
    end as deleted
FROM (
SELECT
LEFT(lower(to_base64(sha1(UUID()))),FLOOR(RAND()*10)+6) AS 'username',
FLOOR(RAND()*6000000000+13000000000) AS 'phone',
FLOOR((RAND()*100)+1) AS 'email_type',
FLOOR((RAND()*3)) AS 'gender',
FLOOR((RAND()*17000+3000)) AS 'salary',
ROUND(RAND()+0.3) AS 'state'
) t
ON DUPLICATE KEY UPDATE update_time=NOW()
;

        if (i=row_total_num or i%row_commit_num=0) then
            commit;
        elseif i%row_commit_num=1 then
            start transaction;
        end if;

        set i=i+1;
    end while;

    commit;
END $$
delimiter ;

-- call proc_tb_test_data(1000000,5000);
/* 受影响记录行数: 0  已找到记录行: 0  警告: 0  持续时间 1 查询: 00:01:34.5 */

-- select count(*) from tb_test;  -- 936248
-- select * from tb_test order by id desc limit 10;
-- select * from tb_test where state=1 and deleted=1 limit 100;
-- truncate table tb_test;
-- ALTER TABLE `tb_test` AUTO_INCREMENT=1;
-- ALTER TABLE `tb_test` ENGINE=InnoDB;
```
#### 3、删除binlog
```sql
show binary logs;
purge binary logs to 'mysql-bin.000006';
```
#### 4、ClickHouse同步
`CREATE DATABASE somedata_without_binlog ENGINE = MaterializeMySQL('10.10.10.16:3306', 'materialize_mysql', 'root', '<your_pass>');`
#### 5、验证数据
`select count(*) from materialize_mysql.mysql_table`

### 二、MaterializedMySQL引擎限制
#### 1、数据类型支持
官方版本：数据类型支持有限；阿里云版本：不支持类型全部转为string
**If MySQL table contains a column of such type, ClickHouse throws exception "Unhandled data type" and stops replication.**
```sql
SELECT
	c.TABLE_SCHEMA ,
	c.TABLE_NAME,
	c.COLUMN_NAME,
	c.DATA_TYPE
FROM
	information_schema.`COLUMNS` c
WHERE
	c.TABLE_SCHEMA = 'test'
	AND c.DATA_TYPE NOT IN ('int', 'time');
```
> DB::Exception: Unknown data type family: time: While executing MYSQL_QUERY_EVENT.
#### 2、主键
Each table in MySQL should contain PRIMARY KEY.
```sql
SELECT
	t.TABLE_SCHEMA,
	t.TABLE_NAME,
	t.TABLE_ROWS
FROM
	information_schema.TABLES t
LEFT JOIN information_schema.columns c ON
	t.TABLE_SCHEMA = c.TABLE_SCHEMA
	AND t.TABLE_NAME = c.TABLE_NAME
	AND t.TABLE_TYPE = 'BASE TABLE'
	AND c.COLUMN_KEY = 'PRI'
WHERE
	t.TABLE_SCHEMA = 'test'
	AND t.TABLE_TYPE = 'BASE TABLE'
	AND c.COLUMN_KEY IS NULL
ORDER BY
	t.TABLE_SCHEMA,
	t.TABLE_NAME;
```
> DB::Exception: The test.mysql_table_without_primary cannot be materialized, because there is no primary keys.
#### 3、ENUM字段超出范围
#### 4、级联UPDATE/DELETE查询
Cascade UPDATE/DELETE queries are not supported by the MaterializedMySQL engine.
```sql
CREATE TABLE `mysql_table` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_at` datetime NOT NULL DEFAULT '2020-08-25 10:10:10' ON UPDATE CURRENT_TIMESTAMP COMMENT '创建时间',
  `name` varchar(64) NOT NULL COMMENT '名字',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='测试';
-- 
INSERT into materialize_mysql.mysql_table (NAME) VALUES ('boer');
update materialize_mysql.mysql_table set name='boer' where id = 1;
```
> 经测试：级联UPDATE可以正常同步

### 三、参考链接
- https://clickhouse.tech/docs/en/engines/database-engines/materialized-mysql/
- https://help.aliyun.com/document_detail/209912.html
- https://www.jianshu.com/p/d0d4306411b3