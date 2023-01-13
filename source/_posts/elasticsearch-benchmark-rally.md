---
title: Elasticsearch基准测试
date: 2021-11-16 15:36:16
index_img: https://picsum.photos/300/200.webp?rally
sticky: 110
tags:
  - Elasticserach
categories: BigData
---
ES 是近乎线性扩展的分布式系统，所以可以总结成同一个测试模式：
1.使用和线上集群相同硬件配置的服务器搭建一个单节点集群。
2.使用和线上集群相同的映射创建一个 0 副本，1 分片的测试索引。
3.使用和线上集群相同的数据写入进行压测。
4.观察写入性能，或者运行查询请求观察搜索聚合性能。
5.持续压测数小时，使用监控系统记录 eps、requesttime、fielddata cache、GC count 等关键数据。

测试完成后，根据监控系统数据，确定单分片的性能拐点，或者适合自己预期值的临界点。这个数据，就是一个基准数据。之后的扩容计划，都可以以这个基准单位进行。

需要注意的是，测试是以分片为单位的，在实际使用中，因为主分片和副本分片都是在各自节点做 indexing 和 merge 操作，需要消耗同样的写入性能。所以，实际集群的容量预估中，要考虑副本数的影响。也就是说，假如你在基准测试中得到单机写入性能在 10000 eps，那么开启一个副本后所能达到的 eps 就只有 5000 了。还想写入 10000 eps 的话，就需要加一倍机器。

<!-- more -->

esrally==2.2.1
elasticsearch==7.10.2

| 概念 | 释义 |
| ---  | ---- |
|team/car  | 测试集群                      |    
|geonames  | 测试数据                      |
|tracks    | 索引定义                      |
|operation | 测试用例 index/search/term... |
|challenge | 执行测试 并发数                | 
|race_id   | 测试报告                      |


# race 
  ~/.rally/benchmarks/races
  esrally list races
  esrally compare --baseline=<race_id_1> --contender=<race_id_2>

# pipeline
  esrally list pipelines
  ** benchmark-only - 已有集群[car] **

# tracks:
  1. operation - 压测的具体操作index/search
  2. challenge - 压测执行的任务throughput/iteration

  3. 离线数据路径: ~/.rally/benchmarks/data/geonames
    - eg. https://github.com/elastic/rally-tracks/blob/master/geonames/track.json
  4. tracks定义仓库：~/.rally/benchmarks/tracks/default 
    - eg. https://github.com/elastic/rally-tracks

# car/team - 不同规格的es集群
https://github.com/elastic/rally-teams

# 执行与输出
```bash
esrally race --pipeline=benchmark-only --target-hosts=<es_vip>:9200 --track=geonames  --client-options="use_ssl:true,basic_auth_user:'admin',basic_auth_password:'admin',verify_certs:false" --challenge=append-no-conflicts  --offline

    ____        ____
   / __ \____ _/ / /_  __
  / /_/ / __ `/ / / / / /
 / _, _/ /_/ / / / /_/ /
/_/ |_|\__,_/_/_/\__, /
                /____/

[INFO] You did not provide an explicit timeout in the client options. Assuming default of 10 seconds.
[INFO] Decompressing track data from [/root/.rally/benchmarks/data/geonames/documents-2.json.bz2] to [/root/.rally/benchmarks/data/geonames/documents-2.json] (resulting size: [3.30] GB) ... [OK]
[INFO] Preparing file offset table for [/root/.rally/benchmarks/data/geonames/documents-2.json] ... [OK]
[INFO] Racing on track [geonames], challenge [append-no-conflicts] and car ['external'] with version [7.10.2].

[WARNING] merges_total_time is 11262 ms indicating that the cluster is not in a defined clean state. Recorded index time metrics may be misleading.
[WARNING] refresh_total_time is 3141 ms indicating that the cluster is not in a defined clean state. Recorded index time metrics may be misleading.
Running delete-index                                                           [100% done]
Running create-index                                                           [100% done]
Running check-cluster-health                                                   [100% done]
Running index-append                                                           [100% done]
Running refresh-after-index                                                    [100% done]
Running force-merge                                                            [100% done]
Running refresh-after-force-merge                                              [100% done]
Running wait-until-merges-finish                                               [100% done]
Running index-stats                                                            [100% done]
Running node-stats                                                             [100% done]
Running default                                                                [100% done]
Running term                                                                   [100% done]
Running phrase                                                                 [100% done]
Running country_agg_uncached                                                   [100% done]
Running country_agg_cached                                                     [100% done]
Running scroll                                                                 [100% done]
Running expression                                                             [100% done]
Running painless_static                                                        [100% done]
Running painless_dynamic                                                       [100% done]
Running decay_geo_gauss_function_score                                         [100% done]
Running decay_geo_gauss_script_score                                           [100% done]
Running field_value_function_score                                             [100% done]
Running field_value_script_score                                               [100% done]
Running large_terms                                                            [100% done]
Running large_filtered_terms                                                   [100% done]
Running large_prohibited_terms                                                 [100% done]
Running desc_sort_population                                                   [100% done]
Running asc_sort_population                                                    [100% done]
Running asc_sort_with_after_population                                         [100% done]
Running desc_sort_geonameid                                                    [100% done]
Running desc_sort_with_after_geonameid                                         [100% done]
Running asc_sort_geonameid                                                     [100% done]
Running asc_sort_with_after_geonameid                                          [100% done]

------------------------------------------------------
    _______             __   _____
   / ____(_)___  ____ _/ /  / ___/_________  ________
  / /_  / / __ \/ __ `/ /   \__ \/ ___/ __ \/ ___/ _ \
 / __/ / / / / / /_/ / /   ___/ / /__/ /_/ / /  /  __/
/_/   /_/_/ /_/\__,_/_/   /____/\___/\____/_/   \___/
------------------------------------------------------
```

# es devtools
```
GET _cluster/health
GET _cluster/settings

GET _cat/indices?v&h=i,pri.store.size,status,rep,docs.count,health
GET /_cat/indices?v&health=red
GET _cat/thread_pool?v

GET _cat/pending_tasks
GET _cluster/allocation/explain

GET _cat/indices?v
GET _nodes/stats
GET _all/_stats
```

# 参考
- https://mp.weixin.qq.com/s/JCIWXCY60IM9reHziuxdoQ
- https://discuss.elastic.co/t/premature-end-of-benchmark-run/102684/3
- https://esrally.readthedocs.io/en/stable/track.html
- https://help.aliyun.com/document_detail/127657.html
- https://grafana.com/grafana/dashboards/14191