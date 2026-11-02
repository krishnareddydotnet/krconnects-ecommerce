package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.model.ProductRequest;
import com.krconnects.catalog.service.DataApiClient;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Admin product endpoints (used by the admin portal). Only for role "admin":
 * SecurityConfig checks the token BEFORE these methods run.
 *
 *   GET    /admin/products/{id}  -> one product with its image PATH (for the edit form)
 *   POST   /admin/products       -> create   (201)
 *   PUT    /admin/products/{id}  -> update   (204)
 *   DELETE /admin/products/{id}  -> delete   (204)
 *
 * The work is forwarded to the Data API (the only service that talks to the database).
 */
@RestController
@RequestMapping("/admin/products")
public class AdminProductController {

    private static final Map<String, String> DATA_API_DOWN =
            Map.of("message", "Product data is temporarily unavailable (Data API unreachable).");

    private final DataApiClient dataApiClient;

    public AdminProductController(DataApiClient dataApiClient) {
        this.dataApiClient = dataApiClient;
    }

    // The public GET /products/{id} returns the FULL image URL. The edit form needs
    // the stored PATH (e.g. "products/mouse.webp"), so admins read it from here.
    @GetMapping("/{id}")
    public ResponseEntity<?> getProduct(@PathVariable int id) {
        try {
            Product product = dataApiClient.getProduct(id);
            return ResponseEntity.ok(product);
        } catch (HttpClientErrorException.NotFound ex) {
            return notFound(id);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    // @Valid = check the ProductRequest rules first; invalid -> 400 (see AdminErrorHandler)
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ProductRequest request) {
        try {
            Product created = dataApiClient.createProduct(trimmed(request));
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable int id, @Valid @RequestBody ProductRequest request) {
        try {
            dataApiClient.updateProduct(id, trimmed(request));
            return ResponseEntity.noContent().build();
        } catch (HttpClientErrorException.NotFound ex) {
            return notFound(id);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable int id) {
        try {
            dataApiClient.deleteProduct(id);
            return ResponseEntity.noContent().build();
        } catch (HttpClientErrorException.NotFound ex) {
            return notFound(id);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(DATA_API_DOWN);
        }
    }

    private ResponseEntity<?> notFound(int id) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Product " + id + " not found."));
    }

    // Remove spaces around the text, and store "no image" as null (not "")
    private ProductRequest trimmed(ProductRequest request) {
        String imageUrl = request.getImageUrl();
        if (imageUrl != null && imageUrl.isBlank()) {
            imageUrl = null;
        }
        if (imageUrl != null) {
            imageUrl = imageUrl.trim();
        }
        return new ProductRequest(request.getName().trim(), request.getCategory().trim(), request.getPrice(), imageUrl);
    }
}
