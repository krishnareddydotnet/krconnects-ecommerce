package com.krconnects.catalog.model;

import java.util.List;

/**
 * One page of products (same shape as the Data API's GET /products/paged).
 *   items      -> products on this page
 *   totalCount -> how many products match in total
 *   totalPages -> how many pages, so the UI can show 1, 2, 3 ...
 */
public class PagedProducts {

    private List<Product> items;
    private int page;
    private int pageSize;
    private int totalCount;
    private int totalPages;

    public PagedProducts() {
    }

    public PagedProducts(List<Product> items, int page, int pageSize, int totalCount, int totalPages) {
        this.items = items;
        this.page = page;
        this.pageSize = pageSize;
        this.totalCount = totalCount;
        this.totalPages = totalPages;
    }

    public List<Product> getItems() {
        return items;
    }

    public void setItems(List<Product> items) {
        this.items = items;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public int getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(int totalCount) {
        this.totalCount = totalCount;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }
}
