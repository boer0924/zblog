---
title: OpenSearch索引迁移/备份工具
date: 2023-12-12 10:30:18
index_img: https://picsum.photos/300/200.webp?osm
tags:
  - OpenSearch
  - migrate
  - es
  - ElasticSearch
categories: SRE
---
OpenSearch is the flexible, scalable, open-source way to build solutions for data-intensive applications.

分享一个OpenSearch索引迁移备份脚本，可自行编译为二进制工具(OSM - OpenSearch Migrator)
1. migrate index docs from source opensearch to target opensearch (auto create target index)
2. backup index docs from source opensearch to local file
3. restore index docs from local file to target opensearch
<!-- more -->

> Tips: 站在坑里提醒个人用户还是使用ElasticSearch，OpenSearch文档近乎没有，Bug还多！

```go
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchutil"
	"github.com/pkg/errors"
	"github.com/schollz/progressbar/v3"
)

var (
	verbose  *bool
	docCount int64
)

type GetIndexResponse struct {
	Aliases  map[string]interface{} `json:"aliases"`
	Mappings map[string]interface{} `json:"mappings"`
	Settings struct {
		Index struct {
			NumberOfShards   string                 `json:"number_of_shards"`
			RefreshInterval  string                 `json:"refresh_interval"`
			NumberOfReplicas string                 `json:"number_of_replicas"`
			Analysis         map[string]interface{} `json:"analysis"`
		} `json:"index"`
	} `json:"settings"`
}

type Hit struct {
	ID     string      `json:"_id"`
	Source interface{} `json:"_source"`
}

type ScrollResponse struct {
	ScrollID string `json:"_scroll_id"`
	Took     int
	Hits     struct {
		Total struct {
			Value int
		}
		Hits []Hit
	}
	TimedOut bool `json:"timed_out"`
}

func main() {
	sourceURL := flag.String("s", "", "source opensearch instance, ie: http://localhost:9200")
	targetURL := flag.String("d", "", "target opensearch instance, ie: http://localhost:9201")
	sourceAuth := flag.String("m", "", "basic auth of source opensearch instance, ie: user:pass")
	targetAuth := flag.String("n", "", "basic auth of target opensearch instance, ie: user:pass")
	sourceIndex := flag.String("x", "", "index name to copy, ie: index-name-v1")
	targetIndex := flag.String("y", "", "index name to save, ie: index-name-v1")
	query := flag.String("q", "", "query against source opensearch instance, filter data before migrate")

	outputFile := flag.String("o", "", "output documents of source index into local file, ie: index-name.json")
	inputFile := flag.String("i", "", "indexing from local dump file, ie: index-name.json")

	verbose = flag.Bool("v", false, "setting log level to debug (default: info)")

	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Functions of %s:\n", flag.CommandLine.Name())
		fmt.Println("  1. migrate index docs from source opensearch to target opensearch (auto create target index)")
		fmt.Println("  2. backup index docs from source opensearch to local file")
		fmt.Println("  3. restore index docs from local file to target opensearch")
		fmt.Println("Commands:")
		flag.PrintDefaults()
	}

	flag.Parse()

	sourceClient, err := opensearch.NewClient(opensearch.Config{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Addresses: []string{*sourceURL},
		Username:  strings.Split(*sourceAuth, ":")[0],
		Password:  strings.Join(strings.Split(*sourceAuth, ":")[1:], ""),
	})
	if err != nil {
		log.Fatalln("cannot initialize source opensearch instance", err)
	}

	targetClient, err := opensearch.NewClient(opensearch.Config{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
		Addresses: []string{*targetURL},
		Username:  strings.Split(*targetAuth, ":")[0],
		Password:  strings.Join(strings.Split(*targetAuth, ":")[1:], ""),
	})
	if err != nil {
		log.Fatalln("cannot initialize target opensearch instance", err)
	}

	var wg sync.WaitGroup
	wg.Add(2)

	documentChan := make(chan interface{})

	// 创建索引
	if *sourceURL != "" && *sourceIndex != "" && *sourceAuth != "" && *targetURL != "" && *targetIndex != "" && *targetAuth != "" {
		err = createIndex(sourceClient, targetClient, *sourceIndex, *targetIndex)
		if err != nil {
			log.Fatal(err)
			os.Exit(1)
		}
	}

	if *sourceURL != "" && *sourceIndex != "" && *sourceAuth != "" {
		// scroll from source instance
		go scrollIndex(sourceClient, *sourceIndex, *query, documentChan, &wg)
	} else if *inputFile != "" {
		// restore from local file
		go restoreIndex(*inputFile, documentChan, &wg)
	}

	if *targetURL != "" && *targetIndex != "" && *targetAuth != "" {
		// bulk to target instance
		go bulkIndex(targetClient, *targetIndex, documentChan, &wg)
	} else if *outputFile != "" {
		// backup to local file
		go dumpIndex(*outputFile, documentChan, &wg)
	}

	wg.Wait()
}

func createIndex(sourceClient, targetClient *opensearch.Client, sourceIndex, targetIndex string) error {
	getIndexResp, err := sourceClient.Indices.Get([]string{sourceIndex}, sourceClient.Indices.Get.WithHuman())
	if err != nil {
		return errors.Wrapf(err, "get index")
	}
	defer getIndexResp.Body.Close()

	resp := map[string]GetIndexResponse{}
	err = json.NewDecoder(getIndexResp.Body).Decode(&resp)
	if err != nil {
		return errors.Wrapf(err, "decode resp")
	}

	// debug
	if *verbose {
		log.Println(resp[sourceIndex])
	}

	var buf bytes.Buffer
	err = json.NewEncoder(&buf).Encode(resp[sourceIndex])
	if err != nil {
		return errors.Wrapf(err, "encode resp")
	}
	createIndexResp, err := targetClient.Indices.Create(targetIndex, targetClient.Indices.Create.WithBody(&buf))
	if err != nil {
		return errors.Wrapf(err, "create index")
	}
	defer createIndexResp.Body.Close()

	if *verbose {
		log.Println(createIndexResp)
	}
	return nil
}

func scrollIndex(client *opensearch.Client, indexName, query string, ch chan interface{}, wg *sync.WaitGroup) error {

	defer wg.Done()

	resp, err := client.Search(
		client.Search.WithIndex(indexName),
		client.Search.WithSize(5000),
		client.Search.WithBody(strings.NewReader(query)),
		// client.Search.WithSort("year:asc"),
		client.Search.WithScroll(10*time.Minute),
		client.Search.WithIgnoreUnavailable(true),
	)
	if err != nil {
		log.Printf("error occurred: [%s]", err.Error())
	}
	defer resp.Body.Close()

	var result ScrollResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return err
	}

	docCount = int64(result.Hits.Total.Value)
	ch <- docCount
	bar := progressbar.Default(docCount, "scroll processing")
	scrollID := result.ScrollID

	for {
		if len(result.Hits.Hits) == 0 {
			break
		}

		for _, hit := range result.Hits.Hits {
			// 进度条
			bar.Add(1)
			// 写入channel
			ch <- hit
		}

		res, err := client.Scroll(
			client.Scroll.WithContext(context.Background()),
			client.Scroll.WithScrollID(scrollID),
			client.Scroll.WithScroll(10*time.Minute),
		)
		if err != nil {
			log.Fatalf("Error getting response: %s", err)
		}

		defer res.Body.Close()
		if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
			return err
		}

		scrollID = result.ScrollID
	}

	// 清理scrollID
	clearScrollResponse, err := client.ClearScroll(
		client.ClearScroll.WithScrollID(scrollID),
	)
	if err != nil {
		log.Fatalf("Error getting response: %s", err)
	}
	if clearScrollResponse.IsError() {
		log.Printf("Error clearing scroll: %s", clearScrollResponse.String())
	} else {
		// log.Printf("Successfully scroll [%d] documents", result.Hits.Total.Value)
		// fmt.Println("Scroll cleared!")
	}

	// 写入方关闭channel
	close(ch)

	return nil
}

func restoreIndex(fileName string, ch chan interface{}, wg *sync.WaitGroup) error {
	defer wg.Done()

	file, err := os.Open(fileName)
	if err != nil {
		return errors.Wrap(err, "Error opening file")

	}

	// 获取总文档数
	var docCount int64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		docCount++
	}
	if err := scanner.Err(); err != nil {
		return errors.Wrap(err, "Error reading file")
	}

	defer close(ch)
	// defer log.Printf("Successfully restore [%d] documents", docCount)

	bar := progressbar.Default(docCount, "restore processing")
	ch <- docCount

	// 重置文件seek
	file.Seek(0, 0)

	var hit Hit
	reader := bufio.NewReader(file)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF { //读取结束，会报EOF
				return nil
			}
			return err
		}
		err = json.Unmarshal(line, &hit)
		if err != nil {
			return err
		}
		bar.Add(1)
		ch <- hit
	}
}

func dumpIndex(fileName string, ch chan interface{}, wg *sync.WaitGroup) error {
	defer wg.Done()

	file, err := os.Create(fileName)
	if err != nil {
		return errors.Wrap(err, "Error creating file")
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	docCount := <-ch
	bar := progressbar.Default(docCount.(int64), "dump processing")

	// 读取channel
	for d := range ch {
		// 进度条
		bar.Add(1)
		// 解析Doc
		doc, ok := d.(Hit)
		if !ok {
			return errors.New("assert error")
		}
		docBytes, err := json.Marshal(doc)
		if err != nil {
			return err
		}
		writer.Write(append(docBytes, '\n'))
	}
	// log.Printf("Successfully dumped [%d] documents", docCount)
	return writer.Flush()
}

func bulkIndex(client *opensearch.Client, indexName string, ch chan interface{}, wg *sync.WaitGroup) error {
	defer wg.Done()

	indexer, err := opensearchutil.NewBulkIndexer(opensearchutil.BulkIndexerConfig{
		Client:     client,           // The OpenSearch client
		Index:      indexName,        // The default index name
		NumWorkers: runtime.NumCPU(), // The number of worker goroutines (default: number of CPUs)
		FlushBytes: 5e+6,             // The flush threshold in bytes (default: 5M)
	})
	if err != nil {
		log.Fatalf("Error creating the indexer: %s", err)
	}

	docCount := <-ch
	bar := progressbar.Default(docCount.(int64), "bulk processing")

	// 读取channel
	for d := range ch {
		// 进度条
		bar.Add(1)
		// 解析Doc
		doc, ok := d.(Hit)
		if !ok {
			return errors.New("assert error")
		}
		docBytes, err := json.Marshal(doc.Source)
		if err != nil {
			return err
		}

		// Add an item to the indexer
		err = indexer.Add(
			context.Background(),
			opensearchutil.BulkIndexerItem{
				// Action field configures the operation to perform (index, create, delete, update)
				Action: "index",

				// DocumentID is the optional document ID
				DocumentID: doc.ID,

				// Body is an `io.Reader` with the payload
				Body: bytes.NewReader(docBytes),

				// OnSuccess is the optional callback for each successful operation
				OnSuccess: func(
					ctx context.Context,
					item opensearchutil.BulkIndexerItem,
					res opensearchutil.BulkIndexerResponseItem,
				) {
					// fmt.Printf("[%d] %s test/%s", res.Status, res.Result, item.DocumentID)
				},

				// OnFailure is the optional callback for each failed operation
				OnFailure: func(
					ctx context.Context,
					item opensearchutil.BulkIndexerItem,
					res opensearchutil.BulkIndexerResponseItem, err error,
				) {
					if err != nil {
						log.Printf("ERROR: %s", err)
					} else {
						log.Printf("ERROR: %s: %s", res.Error.Type, res.Error.Reason)
					}
				},
			},
		)
		if err != nil {
			return errors.Wrapf(err, "add indexer")
		}
	}

	// Close the indexer channel and flush remaining items
	//
	if err := indexer.Close(context.Background()); err != nil {
		log.Fatalf("Unexpected error: %s", err)
	}

	// Report the indexer statistics
	//
	stats := indexer.Stats()
	if stats.NumFailed > 0 {
		log.Fatalf("Indexed [%d] documents with [%d] errors", stats.NumFlushed, stats.NumFailed)
	} else {
		// log.Printf("Successfully indexed [%d] documents", stats.NumFlushed)
	}
	return nil
}
```