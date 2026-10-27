package com.krconnects.catalog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * KRConnects Catalog API
 * Responsible for product catalog data.
 *
 * NOTE (interview-prep / learning scope): This sample does not connect to
 * a real Cosmos DB. See application.yml for the Key Vault reference
 * pattern used in production.
 */
@SpringBootApplication
public class CatalogApplication {

    public static void main(String[] args) {
        SpringApplication.run(CatalogApplication.class, args);
    }
}
