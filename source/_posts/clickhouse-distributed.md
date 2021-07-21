---
title: ClickHouse分布式实践
date: 2021-07-01 10:16:16
index_img: https://picsum.photos/300/200.webp?ch
sticky: 110
tags:
  - ClickHouse
categories: BigData
---
ClickHouse是一个用于联机分析(OLAP)的列式数据库管理系统(DBMS)

<!-- more -->

### ClickHouse配置
```xml
<yandex>
  <logger>
    <level>information</level>
    <log>/var/log/clickhouse-server/clickhouse-server.log</log>
    <errorlog>/var/log/clickhouse-server/clickhouse-server.err.log</errorlog>
    <size>1000M</size>
    <count>10</count>
  </logger>
  <listen_host>0.0.0.0</listen_host>
  <timezone>Asia/Shanghai</timezone>
  <max_connections>4096</max_connections>
  <max_concurrent_queries>100</max_concurrent_queries>
  <max_thread_pool_size>10000</max_thread_pool_size>
  <path>/var/lib/clickhouse/</path>
  <tmp_path>/var/lib/clickhouse/tmp/</tmp_path>
  <user_files_path>/var/lib/clickhouse/user_files/</user_files_path>
  <remote_servers>
    <mycluster>
      <shard>
        <!-- Optional. Shard weight when writing data. Default: 1. -->
        <weight>1</weight>
        <!-- Optional. Whether to write data to just one of the replicas. Default: false (write data to all replicas). -->
        <internal_replication>false</internal_replication>
        <replica>
          <host>vm-node001</host>
          <port>9000</port>
        </replica>
        <replica>
          <host>vm-node002</host>
          <port>9000</port>
        </replica>
        <replica>
          <host>vm-node003</host>
          <port>9000</port>
        </replica>
      </shard>
    </mycluster>
  </remote_servers>
  <zookeeper>
    <node index="1">
      <host>vm-node001</host>
      <port>2181</port>
    </node>
    <node index="2">
      <host>vm-node002</host>
      <port>2181</port>
    </node>
    <node index="3">
      <host>vm-node003</host>
      <port>2181</port>
    </node>
  </zookeeper>
  <!-- vm-node001 -->
  <macros>
    <layer>01</layer>
    <shard>01</shard>
    <replica>vm-node001</replica>
  </macros>
  <!-- vm-node002 -->
  <macros>
    <layer>01</layer>
    <shard>01</shard>
    <replica>vm-node002</replica>
  </macros>
  <!-- vm-node003 -->
  <macros>
    <layer>01</layer>
    <shard>01</shard>
    <replica>vm-node003</replica>
  </macros>
</yandex>
```
> - https://clickhouse.tech/docs/zh/engines/table-engines/mergetree-family/replication/
> - https://clickhouse.tech/docs/zh/getting-started/tutorial/

# 示例
### 创建库
```sql
CREATE DATABASE IF NOT EXISTS tutorial
```

### 创建本地表`hits_v1`
```sql
CREATE TABLE tutorial.hits_v1
(
    `WatchID` UInt64,
    `JavaEnable` UInt8,
    `Title` String,
    `GoodEvent` Int16,
    `EventTime` DateTime,
    `EventDate` Date,
    `CounterID` UInt32,
    `ClientIP` UInt32,
    `ClientIP6` FixedString(16),
    `RegionID` UInt32,
    `UserID` UInt64,
    `CounterClass` Int8,
    `OS` UInt8,
    `UserAgent` UInt8,
    `URL` String,
    `Referer` String,
    `URLDomain` String,
    `RefererDomain` String,
    `Refresh` UInt8,
    `IsRobot` UInt8,
    `RefererCategories` Array(UInt16),
    `URLCategories` Array(UInt16),
    `URLRegions` Array(UInt32),
    `RefererRegions` Array(UInt32),
    `ResolutionWidth` UInt16,
    `ResolutionHeight` UInt16,
    `ResolutionDepth` UInt8,
    `FlashMajor` UInt8,
    `FlashMinor` UInt8,
    `FlashMinor2` String,
    `NetMajor` UInt8,
    `NetMinor` UInt8,
    `UserAgentMajor` UInt16,
    `UserAgentMinor` FixedString(2),
    `CookieEnable` UInt8,
    `JavascriptEnable` UInt8,
    `IsMobile` UInt8,
    `MobilePhone` UInt8,
    `MobilePhoneModel` String,
    `Params` String,
    `IPNetworkID` UInt32,
    `TraficSourceID` Int8,
    `SearchEngineID` UInt16,
    `SearchPhrase` String,
    `AdvEngineID` UInt8,
    `IsArtifical` UInt8,
    `WindowClientWidth` UInt16,
    `WindowClientHeight` UInt16,
    `ClientTimeZone` Int16,
    `ClientEventTime` DateTime,
    `SilverlightVersion1` UInt8,
    `SilverlightVersion2` UInt8,
    `SilverlightVersion3` UInt32,
    `SilverlightVersion4` UInt16,
    `PageCharset` String,
    `CodeVersion` UInt32,
    `IsLink` UInt8,
    `IsDownload` UInt8,
    `IsNotBounce` UInt8,
    `FUniqID` UInt64,
    `HID` UInt32,
    `IsOldCounter` UInt8,
    `IsEvent` UInt8,
    `IsParameter` UInt8,
    `DontCountHits` UInt8,
    `WithHash` UInt8,
    `HitColor` FixedString(1),
    `UTCEventTime` DateTime,
    `Age` UInt8,
    `Sex` UInt8,
    `Income` UInt8,
    `Interests` UInt16,
    `Robotness` UInt8,
    `GeneralInterests` Array(UInt16),
    `RemoteIP` UInt32,
    `RemoteIP6` FixedString(16),
    `WindowName` Int32,
    `OpenerName` Int32,
    `HistoryLength` Int16,
    `BrowserLanguage` FixedString(2),
    `BrowserCountry` FixedString(2),
    `SocialNetwork` String,
    `SocialAction` String,
    `HTTPError` UInt16,
    `SendTiming` Int32,
    `DNSTiming` Int32,
    `ConnectTiming` Int32,
    `ResponseStartTiming` Int32,
    `ResponseEndTiming` Int32,
    `FetchTiming` Int32,
    `RedirectTiming` Int32,
    `DOMInteractiveTiming` Int32,
    `DOMContentLoadedTiming` Int32,
    `DOMCompleteTiming` Int32,
    `LoadEventStartTiming` Int32,
    `LoadEventEndTiming` Int32,
    `NSToDOMContentLoadedTiming` Int32,
    `FirstPaintTiming` Int32,
    `RedirectCount` Int8,
    `SocialSourceNetworkID` UInt8,
    `SocialSourcePage` String,
    `ParamPrice` Int64,
    `ParamOrderID` String,
    `ParamCurrency` FixedString(3),
    `ParamCurrencyID` UInt16,
    `GoalsReached` Array(UInt32),
    `OpenstatServiceName` String,
    `OpenstatCampaignID` String,
    `OpenstatAdID` String,
    `OpenstatSourceID` String,
    `UTMSource` String,
    `UTMMedium` String,
    `UTMCampaign` String,
    `UTMContent` String,
    `UTMTerm` String,
    `FromTag` String,
    `HasGCLID` UInt8,
    `RefererHash` UInt64,
    `URLHash` UInt64,
    `CLID` UInt32,
    `YCLID` UInt64,
    `ShareService` String,
    `ShareURL` String,
    `ShareTitle` String,
    `ParsedParams` Nested(
        Key1 String,
        Key2 String,
        Key3 String,
        Key4 String,
        Key5 String,
        ValueDouble Float64),
    `IslandID` FixedString(16),
    `RequestNum` UInt32,
    `RequestTry` UInt8
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{layer}-{shard}/hits_v1', '{replica}')
PARTITION BY toYYYYMM(EventDate)
ORDER BY (CounterID, EventDate, intHash32(UserID))
SAMPLE BY intHash32(UserID)
```

### 创建本地表`visits_v1`
```sql
CREATE TABLE tutorial.visits_v1
(
    `CounterID` UInt32,
    `StartDate` Date,
    `Sign` Int8,
    `IsNew` UInt8,
    `VisitID` UInt64,
    `UserID` UInt64,
    `StartTime` DateTime,
    `Duration` UInt32,
    `UTCStartTime` DateTime,
    `PageViews` Int32,
    `Hits` Int32,
    `IsBounce` UInt8,
    `Referer` String,
    `StartURL` String,
    `RefererDomain` String,
    `StartURLDomain` String,
    `EndURL` String,
    `LinkURL` String,
    `IsDownload` UInt8,
    `TraficSourceID` Int8,
    `SearchEngineID` UInt16,
    `SearchPhrase` String,
    `AdvEngineID` UInt8,
    `PlaceID` Int32,
    `RefererCategories` Array(UInt16),
    `URLCategories` Array(UInt16),
    `URLRegions` Array(UInt32),
    `RefererRegions` Array(UInt32),
    `IsYandex` UInt8,
    `GoalReachesDepth` Int32,
    `GoalReachesURL` Int32,
    `GoalReachesAny` Int32,
    `SocialSourceNetworkID` UInt8,
    `SocialSourcePage` String,
    `MobilePhoneModel` String,
    `ClientEventTime` DateTime,
    `RegionID` UInt32,
    `ClientIP` UInt32,
    `ClientIP6` FixedString(16),
    `RemoteIP` UInt32,
    `RemoteIP6` FixedString(16),
    `IPNetworkID` UInt32,
    `SilverlightVersion3` UInt32,
    `CodeVersion` UInt32,
    `ResolutionWidth` UInt16,
    `ResolutionHeight` UInt16,
    `UserAgentMajor` UInt16,
    `UserAgentMinor` UInt16,
    `WindowClientWidth` UInt16,
    `WindowClientHeight` UInt16,
    `SilverlightVersion2` UInt8,
    `SilverlightVersion4` UInt16,
    `FlashVersion3` UInt16,
    `FlashVersion4` UInt16,
    `ClientTimeZone` Int16,
    `OS` UInt8,
    `UserAgent` UInt8,
    `ResolutionDepth` UInt8,
    `FlashMajor` UInt8,
    `FlashMinor` UInt8,
    `NetMajor` UInt8,
    `NetMinor` UInt8,
    `MobilePhone` UInt8,
    `SilverlightVersion1` UInt8,
    `Age` UInt8,
    `Sex` UInt8,
    `Income` UInt8,
    `JavaEnable` UInt8,
    `CookieEnable` UInt8,
    `JavascriptEnable` UInt8,
    `IsMobile` UInt8,
    `BrowserLanguage` UInt16,
    `BrowserCountry` UInt16,
    `Interests` UInt16,
    `Robotness` UInt8,
    `GeneralInterests` Array(UInt16),
    `Params` Array(String),
    `Goals` Nested(
        ID UInt32,
        Serial UInt32,
        EventTime DateTime,
        Price Int64,
        OrderID String,
        CurrencyID UInt32),
    `WatchIDs` Array(UInt64),
    `ParamSumPrice` Int64,
    `ParamCurrency` FixedString(3),
    `ParamCurrencyID` UInt16,
    `ClickLogID` UInt64,
    `ClickEventID` Int32,
    `ClickGoodEvent` Int32,
    `ClickEventTime` DateTime,
    `ClickPriorityID` Int32,
    `ClickPhraseID` Int32,
    `ClickPageID` Int32,
    `ClickPlaceID` Int32,
    `ClickTypeID` Int32,
    `ClickResourceID` Int32,
    `ClickCost` UInt32,
    `ClickClientIP` UInt32,
    `ClickDomainID` UInt32,
    `ClickURL` String,
    `ClickAttempt` UInt8,
    `ClickOrderID` UInt32,
    `ClickBannerID` UInt32,
    `ClickMarketCategoryID` UInt32,
    `ClickMarketPP` UInt32,
    `ClickMarketCategoryName` String,
    `ClickMarketPPName` String,
    `ClickAWAPSCampaignName` String,
    `ClickPageName` String,
    `ClickTargetType` UInt16,
    `ClickTargetPhraseID` UInt64,
    `ClickContextType` UInt8,
    `ClickSelectType` Int8,
    `ClickOptions` String,
    `ClickGroupBannerID` Int32,
    `OpenstatServiceName` String,
    `OpenstatCampaignID` String,
    `OpenstatAdID` String,
    `OpenstatSourceID` String,
    `UTMSource` String,
    `UTMMedium` String,
    `UTMCampaign` String,
    `UTMContent` String,
    `UTMTerm` String,
    `FromTag` String,
    `HasGCLID` UInt8,
    `FirstVisit` DateTime,
    `PredLastVisit` Date,
    `LastVisit` Date,
    `TotalVisits` UInt32,
    `TraficSource` Nested(
        ID Int8,
        SearchEngineID UInt16,
        AdvEngineID UInt8,
        PlaceID UInt16,
        SocialSourceNetworkID UInt8,
        Domain String,
        SearchPhrase String,
        SocialSourcePage String),
    `Attendance` FixedString(16),
    `CLID` UInt32,
    `YCLID` UInt64,
    `NormalizedRefererHash` UInt64,
    `SearchPhraseHash` UInt64,
    `RefererDomainHash` UInt64,
    `NormalizedStartURLHash` UInt64,
    `StartURLDomainHash` UInt64,
    `NormalizedEndURLHash` UInt64,
    `TopLevelDomain` UInt64,
    `URLScheme` UInt64,
    `OpenstatServiceNameHash` UInt64,
    `OpenstatCampaignIDHash` UInt64,
    `OpenstatAdIDHash` UInt64,
    `OpenstatSourceIDHash` UInt64,
    `UTMSourceHash` UInt64,
    `UTMMediumHash` UInt64,
    `UTMCampaignHash` UInt64,
    `UTMContentHash` UInt64,
    `UTMTermHash` UInt64,
    `FromHash` UInt64,
    `WebVisorEnabled` UInt8,
    `WebVisorActivity` UInt32,
    `ParsedParams` Nested(
        Key1 String,
        Key2 String,
        Key3 String,
        Key4 String,
        Key5 String,
        ValueDouble Float64),
    `Market` Nested(
        Type UInt8,
        GoalID UInt32,
        OrderID String,
        OrderPrice Int64,
        PP UInt32,
        DirectPlaceID UInt32,
        DirectOrderID UInt32,
        DirectBannerID UInt32,
        GoodID String,
        GoodName String,
        GoodQuantity Int32,
        GoodPrice Int64),
    `IslandID` FixedString(16)
)
ENGINE = ReplicatedCollapsingMergeTree('/clickhouse/tables/{layer}-{shard}/visits_v1', '{replica}', Sign)
PARTITION BY toYYYYMM(StartDate)
ORDER BY (CounterID, StartDate, intHash32(UserID), VisitID)
SAMPLE BY intHash32(UserID)
```
**本地表需要在所有node上创建**

### 创建分布式表
```sql
-- hits_v1
CREATE TABLE tutorial.hits_v1_dis ON CLUSTER mycluster
 AS tutorial.hits_v1 
ENGINE = Distributed(mycluster, tutorial, hits_v1, rand())
-- visits_v1
CREATE TABLE tutorial.visits_v1_dis ON CLUSTER mycluster
 AS tutorial.visits_v1 
ENGINE = Distributed(mycluster, tutorial, visits_v1, rand())
```
**分布式表在shard的其中一台创建即可，其他replica无需执行**

### 导入测试数据
```bash
curl https://datasets.clickhouse.tech/hits/tsv/hits_v1.tsv.xz | unxz --threads=`nproc` > hits_v1.tsv
curl https://datasets.clickhouse.tech/visits/tsv/visits_v1.tsv.xz | unxz --threads=`nproc` > visits_v1.tsv

clickhouse-client --query "INSERT INTO tutorial.hits_v1_dis FORMAT TSV" --max_insert_block_size=100000 < hits_v1.tsv

clickhouse-client --query "INSERT INTO tutorial.visits_v1_dis FORMAT TSV" --max_insert_block_size=100000 < visits_v1.tsv
```

### 验证数据
```sql
select count(*) from tutorial.hits_v1_dis
-- 
select count(*) from tutorial.visits_v1_dis
-- 
SELECT
    StartURL AS URL,
    AVG(Duration) AS AvgDuration
FROM tutorial.visits_v1
WHERE StartDate BETWEEN '2014-03-23' AND '2014-03-30'
GROUP BY URL
ORDER BY AvgDuration DESC
LIMIT 10
-- 
SELECT
    sum(Sign) AS visits,
    sumIf(Sign, has(Goals.ID, 1105530)) AS goal_visits,
    (100. * goal_visits) / visits AS goal_percent
FROM tutorial.visits_v1
WHERE (CounterID = 912887) AND (toYYYYMM(StartDate) = 201403) AND (domain(StartURL) = 'yandex.ru')
```

### Ops
```sql
SELECT
    cluster,
    shard_num,
    replica_num,
    host_name,
    is_local,
    user,
    default_database
FROM system.clusters
```

### 用户权限
```xml
<yandex>
  <users>
    <!-- If user name was not specified, 'default' user is used. -->
    <user_name>
      <password></password>
      <!-- Or -->
      <!-- PASSWORD=$(base64 < /dev/urandom | head -c8); echo "$PASSWORD"; echo -n "$PASSWORD" | sha256sum | tr -d '-' -->
      <password_sha256_hex></password_sha256_hex>
      <access_management>1</access_management>

      <networks incl="networks" replace="replace">
      </networks>

      <profile>profile_name</profile>

      <quota>default</quota>

      <databases>
          <database_name>
              <table_name>
                  <filter>expression</filter>
              <table_name>
          </database_name>
      </databases>
    </user_name>
    <!-- Other users settings -->
  </users>
</yandex>
```

```bash
PASSWORD=$(base64 < /dev/urandom | head -c8); echo "$PASSWORD"; echo -n "$PASSWORD" | sha256sum | tr -d '-'
```

- https://clickhouse.tech/docs/zh/operations/access-rights/


# 理想配置
> - https://altinity.com/blog/2018/5/10/circular-replication-cluster-topology-in-clickhouse
> - https://github.com/ClickHouse/ClickHouse/issues/1287
```xml
  <remote_servers>
    <mycluster>
        <shard>
            <!-- Optional. Shard weight when writing data. Default: 1. -->
            <weight>1</weight>
            <!-- Optional. Whether to write data to just one of the replicas. Default: false (write data to all replicas). -->
            <internal_replication>false</internal_replication>
            <replica>
                <host>vm-node001</host>
                <port>9000</port>
            </replica>
            <replica>
                <host>vm-node002</host>
                <port>9000</port>
            </replica>
        </shard>
        <shard>
            <weight>2</weight>
            <internal_replication>false</internal_replication>
            <replica>
                <host>vm-node002</host>
                <port>9000</port>
            </replica>
            <replica>
                <host>vm-node003</host>
                <port>9000</port>
            </replica>
        </shard>
        <shard>
            <weight>3</weight>
            <internal_replication>false</internal_replication>
            <replica>
                <host>vm-node003</host>
                <port>9000</port>
            </replica>
            <replica>
                <host>vm-node001</host>
                <port>9000</port>
            </replica>
        </shard>
    </mycluster>
  </remote_servers>
  <zookeeper>
    <node index="1">
        <host>vm-node001</host>
        <port>2181</port>
    </node>
    <node index="2">
        <host>vm-node002</host>
        <port>2181</port>
    </node>
    <node index="3">
        <host>vm-node003</host>
        <port>2181</port>
    </node>
  </zookeeper>
  <!-- vm-node001 -->
  <macros>
    <layer>01</layer>
    <shard>01</shard>
    <replica>vm-node002</replica>
  </macros>
  <!-- vm-node002 -->
  <macros>
    <layer>02</layer>
    <shard>02</shard>
    <replica>vm-node003</replica>
  </macros>
  <!-- vm-node003 -->
  <macros>
    <layer>03</layer>
    <shard>03</shard>
    <replica>vm-node001</replica>
  </macros>
```