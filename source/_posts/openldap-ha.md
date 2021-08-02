---
title: N-Way Multi-Provider OpenLDAP实践
date: 2021-07-25 16:50:16
index_img: https://picsum.photos/300/200.webp?ldap
tags:
  - OpenLDAP
categories: DevOps
---

Replicated directories are a fundamental requirement for delivering a resilient enterprise deployment.

<!-- more -->

| Server ID | IP Address | Port | RootDomain |
| --- | --- | --- | --- |
| 1 | 10.10.253.16 | 10389 | dc=boer,dc=xyz |
| 2 | 10.10.253.17 | 10389 | dc=boer,dc=xyz |

### 基础安装
yum install openldap openldap-servers openldap-clients
- openldap-2.4.44-23.el7_9.x86_64
- openldap-clients-2.4.44-23.el7_9.x86_64
- openldap-servers-2.4.44-23.el7_9.x86_64

```bash
cp /usr/share/openldap-servers/DB_CONFIG.example /var/lib/ldap/DB_CONFIG
chown ldap:ldap /var/lib/ldap/DB_CONFIG
```

### 更改默认端口
```bash
vim /etc/sysconfig/slapd
SLAPD_URLS="ldapi:/// ldap://127.0.0.1 ldap://10.10.253.17:10389"

# 最后面不能加/
# https://www.openldap.com/lists/openldap-technical/201908/msg00064.html
```

### 设置密码
`slappasswd -s <your plain password>`

### 根域
rootdomain.ldif
ldapmodify -H ldapi:/// -f rootdomain.ldif
```ldif
dn: olcDatabase={2}hdb,cn=config
changetype: modify
replace: olcRootDN
olcRootDN: cn=admin,dc=boer,dc=xyz
-
replace: olcSuffix
olcSuffix: dc=boer,dc=xyz
-
replace: olcRootPW
olcRootPW: {SSHA}TB15thSmhidpmyPOl2wXe0j0R5AU2kph

dn: olcDatabase={1}monitor,cn=config
changetype: modify
replace: olcAccess
olcAccess: {0}to * by dn.base="gidNumber=0+uidNumber=0,cn=peercred,cn=extern
 al,cn=auth" read by dn.base="cn=admin,dc=boer,dc=xyz" read by * none
```

### 导入schema
ls /etc/openldap/schema/*.ldif | while read f; do ldapadd -Y EXTERNAL -H ldapi:/// -f $f; done

### 默认域
basedomain.ldif
ldapadd -H ldapi:/// -f basedomain.ldif
ldapadd -x -H ldapi:/// -D cn=admin,dc=boer,dc=xyz -W -f basedomain.ldif
```ldif
# vim basedomain.ldif
dn: dc=boer,dc=xyz
objectClass: top
objectClass: dcObject
objectclass: organization
o: Boer Inc
dc: boer

dn: ou=users,dc=boer,dc=xyz
objectClass: organizationalUnit
ou: users

dn: ou=groups,dc=boer,dc=xyz
objectClass: organizationalUnit
ou: groups
```

### HA
syncprov_mod.ldif
ldapadd -H ldapi:/// -f syncprov_mod.ldif
```ldif
dn: cn=module,cn=config
objectClass: olcModuleList
cn: module
olcModulePath: /usr/local/libexec/openldap
olcModuleLoad: syncprov.la
```

config_repl.ldif
ldapmodify -H ldapi:/// -f config_repl.ldif
```ldif
### Update Server ID with LDAP URL ###
dn: cn=config
changetype: modify
replace: olcServerID
olcServerID: 1 ldap://10.10.253.16:10389
olcServerID: 2 ldap://10.10.253.17:10389

### Enable replication ###
### config repl
dn: olcOverlay=syncprov,olcDatabase={0}config,cn=config
changetype: add
objectClass: olcOverlayConfig
objectClass: olcSyncProvConfig
olcOverlay: syncprov

### config repl details
dn: olcDatabase={0}config,cn=config
changetype: modify
add: olcSyncRepl
olcSyncRepl:
  rid=001
  provider=ldap://10.10.253.16:10389
  binddn="cn=admin,dc=boer,dc=xyz"
  bindmethod=simple
  credentials=Root_123
  searchbase="cn=config"
  type=refreshAndPersist
  retry="5 5 300 5"
  timeout=1
olcSyncRepl:
  rid=002
  provider=ldap://10.10.253.17:10389
  binddn="cn=admin,dc=boer,dc=xyz"
  bindmethod=simple
  credentials=Root_123
  searchbase="cn=config"
  type=refreshAndPersist
  retry="5 5 300 5"
  timeout=1
-
add: olcMirrorMode
olcMirrorMode: TRUE

###
### hdb data repl
dn: olcOverlay=syncprov,olcDatabase={2}hdb,cn=config
changetype: add
objectClass: olcOverlayConfig
objectClass: olcSyncProvConfig
olcOverlay: syncprov

### Adding details for replication ###
dn: olcDatabase={2}hdb,cn=config
changetype: modify
add: olcSyncRepl
olcSyncRepl:
  rid=001
  provider=ldap://10.10.253.16:10389
  binddn="cn=admin,dc=boer,dc=xyz"
  bindmethod=simple
  credentials=Root_123
  searchbase="dc=boer,dc=xyz"
  type=refreshAndPersist
  retry="5 5 300 5"
  timeout=1
olcSyncRepl:
  rid=002
  provider=ldap://10.10.253.17:10389
  binddn="cn=admin,dc=boer,dc=xyz"
  bindmethod=simple
  credentials=Root_123
  searchbase="dc=boer,dc=xyz"
  type=refreshAndPersist
  retry="5 5 300 5"
  timeout=1
-
add: olcMirrorMode
olcMirrorMode: TRUE
```

### 管理端LDAP Admin
LDAP Admin

ldapmodify
ldapadd
ldapdelete
ldapsearch
slaptest -u

### Ref
- https://www.openldap.org/doc/admin24/replication.html
- https://www.jianshu.com/p/d7fbeb12d138