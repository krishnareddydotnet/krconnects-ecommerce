package com.krconnects.catalog.service;

import com.krconnects.catalog.model.PagedProducts;
import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.model.ProductRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Calls the Data API over HTTP.
 *
 * The Data API is the ONLY service that talks to SQL Server, so catalog-api
 * gets its products from here instead of a hardcoded list.
 *
 * The Data API address comes from application.yml (krconnects.data-api.url),
 * which reads the DATA_API_URL environment variable and falls back to
 * http://data-api:8080 (the Kubernetes Service name, resolved by CoreDNS).
 */
@Component
public class DataApiClient {

    private final RestClient restClient;

    public DataApiClient(@Value("${krconnects.data-api.url}") String dataApiUrl) {
        // Don't wait forever if the Data API is slow or down
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));

        this.restClient = RestClient.builder()
                .baseUrl(dataApiUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * GET {dataApiUrl}/products  ->  list of products from the database.
     * Throws a RestClientException if the Data API can't be reached or returns an error.
     */
    public List<Product> getProducts() {
        return restClient.get()
                .uri("/products")
                .retrieve()
                .body(new ParameterizedTypeReference<List<Product>>() {});
    }

    /**
     * GET {dataApiUrl}/products/paged?page=1&pageSize=24&search=..&category=..&sort=..
     * Empty values are simply not sent.
     */
    public PagedProducts getProductsPage(int page, int pageSize, String search, String category, String sort) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/products/paged")
                        .queryParam("page", page)
                        .queryParam("pageSize", pageSize)
                        .queryParamIfPresent("search", notBlank(search))
                        .queryParamIfPresent("category", notBlank(category))
                        .queryParamIfPresent("sort", notBlank(sort))
                        .build())
                .retrieve()
                .body(PagedProducts.class);
    }

    /**
     * GET {dataApiUrl}/products/{id}  ->  one product.
     * Throws HttpClientErrorException.NotFound if the id does not exist.
     */
    public Product getProduct(int id) {
        return restClient.get()
                .uri("/products/{id}", id)
                .retrieve()
                .body(Product.class);
    }

    /**
     * GET {dataApiUrl}/products/categories  ->  ["Beauty", "Books", ...]
     */
    public List<String> getCategories() {
        return restClient.get()
                .uri("/products/categories")
                .retrieve()
                .body(new ParameterizedTypeReference<List<String>>() {});
    }

    // ----- Admin: create / update / delete (catalog-api checks the admin token first) -----

    /**
     * POST {dataApiUrl}/products  ->  the created product (201).
     */
    public Product createProduct(ProductRequest request) {
        return restClient.post()
                .uri("/products")
                .body(request)
                .retrieve()
                .body(Product.class);
    }

    /**
     * PUT {dataApiUrl}/products/{id}  ->  204.
     * Throws HttpClientErrorException.NotFound if the id does not exist.
     */
    public void updateProduct(int id, ProductRequest request) {
        restClient.put()
                .uri("/products/{id}", id)
                .body(request)
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * DELETE {dataApiUrl}/products/{id}  ->  204.
     * Throws HttpClientErrorException.NotFound if the id does not exist.
     */
    public void deleteProduct(int id) {
        restClient.delete()
                .uri("/products/{id}", id)
                .retrieve()
                .toBodilessEntity();
    }

    // "" or null -> not sent as a query parameter
    private static Optional<String> notBlank(String value) {
        return (value == null || value.isBlank()) ? Optional.empty() : Optional.of(value);
    }
}
