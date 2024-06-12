---
title: Golang - gofiber-with-casbin授权示例
date: 2024-03-24 10:36:20
index_img: https://picsum.photos/300/200.webp?casbin
tags:
  - Golang
  - RBAC
categories: Golang
---
Casbin是一个支持如ACL, RBAC, ABAC等访问模型的的授权库，支持众多语言。

Fiber is a Go web framework built on top of Fasthttp, the fastest HTTP engine for Go. It's designed to ease things up for fast development with zero memory allocation and performance in mind.
号称: zero memory allocation

<!-- more -->

model.conf
```conf
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act)
```

policy.csv
```
p,admin,/api/todos,GET
p,admin,/api/todos,POST
p,admin,/api/todos/:id,GET
p,admin,/api/todos/:id,PUT
p,admin,/api/todos/:id,DELETE
p,viewer,/api/todos,GET
p,viewer,/api/todos/:id,GET

g,boer,admin
g,john,viewer
```

main.go
```go
func main() {
  app := fiber.New()

  authz := casbin.New(casbin.Config{
		ModelFilePath: "./model.conf",
		PolicyAdapter: fileadapter.NewAdapter("./policy.csv"),
		Lookup:        func(c *fiber.Ctx) string { return internalauthn.GetUserName(c) },
		Unauthorized: func(c *fiber.Ctx) error {
			return c.JSON(fiber.Map{
				"message": "Invalid or expired JWT",
				"code":    fiber.StatusUnauthorized,
			})
		},
		Forbidden: func(c *fiber.Ctx) error {
			return c.JSON(fiber.Error{
				Message: "Forbidden",
				Code:    fiber.StatusForbidden,
			})
		},
	})
}
```