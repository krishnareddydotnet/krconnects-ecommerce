package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.HelloResponse;
import com.krconnects.catalog.service.CatalogInfoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;

import java.time.Instant;

@RestController
public class HelloController {

    private final CatalogInfoService catalogInfoService;

    public HelloController(CatalogInfoService catalogInfoService) {
        this.catalogInfoService = catalogInfoService;
    }

    // GET / - simple root identifier so hitting the base URL immediately
    // shows which app this is, without needing to know a specific route.
    @GetMapping("/")
    public HelloResponse root() {
        return catalogInfoService.getHello();
    }

    // GET /hello - identifies this service and proves the frontend-to-API
    // call works.
    @GetMapping("/hello")
    public HelloResponse hello() {
        return catalogInfoService.getHello();
    }

    // GET /products - products from the database, via the Data API.
    // If the Data API is down, return 503 (Service Unavailable) with a clear
    // message instead of a confusing 500 error.
    @GetMapping("/products")
    public ResponseEntity<HelloResponse> products() {
        try {
            return ResponseEntity.ok(catalogInfoService.getProducts());
        } catch (RestClientException ex) {
            HelloResponse error = new HelloResponse(
                    "Product data is temporarily unavailable (Data API unreachable).",
                    "krconnects-catalog-api",
                    Instant.now().toString(),
                    null
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
        }
    }
}
