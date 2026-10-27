package com.krconnects.catalog.model;

import java.util.List;

/**
 * Response returned by the /hello and /products endpoints.
 * Timestamp is generated server-side on every request, so a fresh
 * value proves a live round-trip call actually occurred.
 */
public class HelloResponse {

    private String message;
    private String service;
    private String timestamp;
    private List<Product> products;

    public HelloResponse() {
    }

    public HelloResponse(String message, String service, String timestamp, List<Product> products) {
        this.message = message;
        this.service = service;
        this.timestamp = timestamp;
        this.products = products;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public List<Product> getProducts() {
        return products;
    }

    public void setProducts(List<Product> products) {
        this.products = products;
    }
}
