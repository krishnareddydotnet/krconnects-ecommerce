package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.PagedProducts;
import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.service.CatalogInfoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Product endpoints used by the customer portal:
 *   GET /products/paged?page=1&pageSize=24&search=&category=&sort=   -> one page + total count
 *   GET /products/categories                                         -> category list
 *   GET /products/{id}                                               -> one product
 * (GET /products - all products - stays in HelloController for older callers.)
 *
 * If the Data API is down we return 503 with a clear message instead of a 500.
 */
@RestController
public class ProductController {

    private static final Map<String, String> DATA_API_DOWN =
            Map.of("message", "Product data is temporarily unavailable (Data API unreachable).");

    private final CatalogInfoService catalogInfoService;

    public ProductController(CatalogInfoService catalogInfoService) {
        this.catalogInfoService = catalogInfoService;
    }

    @GetMapping("/products/paged")
    public ResponseEntity<?> productsPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int pageSize,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sort) {
        try {
            PagedProducts result = catalogInfoService.getProductsPage(page, pageSize, search, category, sort);
            return ResponseEntity.ok(result);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    @GetMapping("/products/categories")
    public ResponseEntity<?> categories() {
        try {
            List<String> categories = catalogInfoService.getCategories();
            return ResponseEntity.ok(categories);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<?> product(@PathVariable int id) {
        try {
            Product product = catalogInfoService.getProduct(id);
            return ResponseEntity.ok(product);
        } catch (HttpClientErrorException.NotFound ex) {
            // Data API said 404 -> pass the 404 on
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Product " + id + " not found."));
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }
}
