---
title: MySQL获取Largest表TopN
date: 2018-03-08 10:30:18
index_img: https://picsum.photos/300/200.webp?mysql-topN
tags:
  - MySQL
  - information_schema
categories: DevOps
---

获取数据库记录数/数据大小/索引大小排名前N的表

<!-- more -->

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

- https://dataedo.com/kb/query/mysql/list-10-largest-tables
- https://developer.aliyun.com/ask/283493