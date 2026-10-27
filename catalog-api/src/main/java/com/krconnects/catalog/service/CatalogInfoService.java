package com.krconnects.catalog.service;

import com.krconnects.catalog.model.HelloResponse;
import com.krconnects.catalog.model.PagedProducts;
import com.krconnects.catalog.model.Product;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Contains the response-building logic for Catalog API's identity and
 * product endpoints. Kept separate from the controller so the controller
 * stays a thin HTTP layer.
 *
 * Products now come from the Data API (SQL Server), not a hardcoded list.
 */
@Service
public class CatalogInfoService {

    private static final String SERVICE_NAME = "krconnects-catalog-api";

    private final DataApiClient dataApiClient;

    // Base URL for product images, from configuration (env var IMAGES_BASE_URL).
    // Today:  https://<storage>.blob.core.windows.net/
    // Later:  https://www.krconnects.com/images/   (Front Door) - only this value changes.
    // Empty = no images configured -> imageUrl is null and the UI shows a placeholder.
    private final String imagesBaseUrl;

    public CatalogInfoService(DataApiClient dataApiClient,
                              @Value("${krconnects.images.base-url:}") String imagesBaseUrl) {
        this.dataApiClient = dataApiClient;
        this.imagesBaseUrl = imagesBaseUrl;
    }

    public HelloResponse getHello() {
        return new HelloResponse(
                "This is the KRConnects Catalog API — responsible for product catalog data.",
                SERVICE_NAME,
                Instant.now().toString(),
                null
        );
    }

    // Asks the Data API for the products and wraps them in the same response
    // shape the customer portal already expects: { message, service, timestamp, products }
    public HelloResponse getProducts() {
        List<Product> products = dataApiClient.getProducts();
        products.forEach(this::addFullImageUrl);

        return new HelloResponse(
                "KRConnects Catalog API — product catalog data from the Data API.",
                SERVICE_NAME,
                Instant.now().toString(),
                products
        );
    }

    // One page of products (search, category and sort are done by the Data API / database)
    public PagedProducts getProductsPage(int page, int pageSize, String search, String category, String sort) {
        PagedProducts result = dataApiClient.getProductsPage(page, pageSize, search, category, sort);
        result.getItems().forEach(this::addFullImageUrl);
        return result;
    }

    public Product getProduct(int id) {
        Product product = dataApiClient.getProduct(id);
        addFullImageUrl(product);
        return product;
    }

    public List<String> getCategories() {
        return dataApiClient.getCategories();
    }

    // "products/wireless-mouse.webp"  ->  "https://<storage>.blob.core.windows.net/products/wireless-mouse.webp"
    private void addFullImageUrl(Product product) {
        String path = product.getImageUrl();

        if (imagesBaseUrl == null || imagesBaseUrl.isBlank() || path == null || path.isBlank()) {
            product.setImageUrl(null);   // no image -> UI shows the placeholder
            return;
        }

        String base = imagesBaseUrl.endsWith("/") ? imagesBaseUrl : imagesBaseUrl + "/";
        product.setImageUrl(base + path);
    }
}
