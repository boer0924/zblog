---
title: 阿里云API监控
date: 2020-06-24 17:10:18
index_img: https://picsum.photos/300/200.webp?redis
banner_img: https://for-boer-blog.oss-cn-beijing.aliyuncs.com/bg006.jpg
tags:
  - Aliyun
  - Redis
  - API
  - SDK
categories: DevOps
---
使用阿里云API-SDK获取阿里云Redis的监控指标

<!-- more -->

```python
import json
import datetime

from aliyunsdkcore.client import AcsClient
from aliyunsdkcore.acs_exception.exceptions import ClientException
from aliyunsdkcore.acs_exception.exceptions import ServerException
from aliyunsdkr_kvstore.request.v20150101.DescribeHistoryMonitorValuesRequest import DescribeHistoryMonitorValuesRequest


def get_metric(metric):
    client = AcsClient('<accessKeyId>', '<accessSecret>', 'cn-beijing')

    request = DescribeHistoryMonitorValuesRequest()
    request.set_accept_format('json')

    # Alyun utc格式
    utc_now = datetime.datetime.utcnow()
    utc_minutes_later = utc_now + datetime.timedelta(minutes=1)
    aliyun_utc_format = '%Y-%m-%dT%H:%M:00Z'
    start_time = utc_now.strftime(aliyun_utc_format)
    end_time = utc_minutes_later.strftime(aliyun_utc_format)

    request.set_StartTime(start_time)
    request.set_EndTime(end_time)
    request.set_IntervalForHistory('01m')
    request.set_InstanceId('r-2zef7cf6dadbd110')
    request.set_MonitorKeys(metric)

    response = client.do_action_with_exception(request)

    resp_json = json.loads(response.decode())
    # print(resp_json)
    monitor_history = resp_json.get('MonitorHistory')
    print(json.loads(monitor_history).get(start_time).get(metric)) # start_time


if __name__ == "__main__":
    get_metric('Keys')  # Key总数量，即实例存储的一级Key总数。Counts
    get_metric('CpuUsage')  # CPU使用率。%
    get_metric('InFlow')  # 入流量速率。KBps
    get_metric('OutFlow')  # 出流量速率。KBps
    get_metric('UsedMemory')  # 数据占用的内存。Bytes
    get_metric('memoryUsage')  # 内存使用率。%
```

### 引用参考
- https://api.aliyun.com/#/?product=R-kvstore
- https://help.aliyun.com/document_detail/189831.html