---
title: Golang - Gin&Gorm分页实现
date: 2020-8-15 10:36:16
index_img: https://picsum.photos/300/200.webp?paginate
tags:
  - Golang
  - Gin
  - Gorm
  - 分页
categories: Golang
---
HTTP处理流程:
1. 接收参数
2. 参数验证
3. 处理逻辑
4. 入库操作
5. 返回用户

<!-- more -->

1、接收前端请求，路由到指定Handler
```go
// http://127.0.0.1:8080/api/v1/users?page=1&page_size=10&age=30
func main() {
	r := gin.Default()
	r.GET("/users", v1.ListUser)
	r.Run()
}
```
2、Hander解析前端请求的查询参数: page, page_size, age
```go
func ListUser(c *gin.Context) {
	resp := app.NewResponse(c)
	pager := app.Pager{Page: app.GetPage(c), PageSize: app.GetPageSize(c)}
	users, totalRows := model.ListUser(pager)
	resp.ToResponseList(users, totalRows)
}
// 粗暴的方法
func ListUserV2(c *gin.Context) {
	var users []User // 返回对象结果集
	page := c.Query("page") // 转int
	pageSize := c.Query("page_size")
	age := c.Query("age")
	results := g.DB.Where("age = ?", age).Find(&users) // g.DB 全局db句柄
	totalRows := results.RowsAffected
	offset := (page - 1) * pageSize
	results.Offset().Limit(pageSize).Find(&users)
	c.JSON(200, gin.H{
		"data": users,
		"page": page,
		"page_size": pageSize,
		"total_rows": totalRows,
	})
}
```
3、Model根据Handler解析的查询参数，查询数据库，返回符合条件的总数据条数，并在次结果集之上返回当前页的数据集
```go
func ListUser(p app.Pager) ([]U, int64) {
	var users []U
	// 总数据结果集
	results := db.Where("age = ?", 30).Find(&users)
	totalRows := results.RowsAffected
	// 当前页结果集
	results.Scopes(Paginate(p)).Find(&users)
	return users, totalRows
}
```

3.1、分页
```go
// 分页
func Paginate(p app.Pager) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		offset := app.GetPageOffset(p.Page, p.PageSize)
		return db.Offset(offset).Limit(p.PageSize)
	}
}
```
