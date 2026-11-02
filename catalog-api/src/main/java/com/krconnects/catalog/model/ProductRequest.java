package com.krconnects.catalog.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Body of POST /admin/products and PUT /admin/products/{id}.
 * Checked BEFORE it is sent to the Data API: invalid input -> 400 with a clear message.
 * (Lengths match the Data API's database columns.)
 */
public class ProductRequest {

    @NotBlank(message = "name is required")
    @Size(min = 2, max = 100, message = "name must be 2 to 100 characters")
    private String name;

    @NotBlank(message = "category is required")
    @Size(min = 2, max = 50, message = "category must be 2 to 50 characters")
    private String category;

    @NotNull(message = "price is required")
    @DecimalMin(value = "0", inclusive = false, message = "price must be more than 0")
    @DecimalMax(value = "1000000", inclusive = false, message = "price must be less than 1,000,000")
    @Digits(integer = 7, fraction = 2, message = "price can have at most 2 decimals")
    private BigDecimal price;

    // Optional image PATH (not a full URL), e.g. "products/laptop-stand.webp".
    // catalog-api adds the storage base URL when products are read.
    @Size(max = 200, message = "imageUrl must be at most 200 characters")
    private String imageUrl;

    public ProductRequest() {
    }

    public ProductRequest(String name, String category, BigDecimal price, String imageUrl) {
        this.name = name;
        this.category = category;
        this.price = price;
        this.imageUrl = imageUrl;
    }

    /**
     * imageUrl must be a simple relative path: letters, digits, "/", "_", "-", ".".
     * Not allowed: full URLs ("https://..."), a leading "/", or ".." (going up folders),
     * so nobody can point a product image at another website.
     */
    @JsonIgnore
    @AssertTrue(message = "imageUrl must be a relative path like products/my-image.webp")
    public boolean isImageUrlValid() {
        if (imageUrl == null || imageUrl.isBlank()) {
            return true;   // optional
        }
        if (imageUrl.startsWith("/") || imageUrl.contains("..")) {
            return false;
        }
        return imageUrl.matches("[A-Za-z0-9/_.-]+");
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
