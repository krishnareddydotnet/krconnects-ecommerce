package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.PagedProducts;
import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.service.DataApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Image base URL is set for these tests, so we can check the full image URL
@SpringBootTest(properties = "krconnects.images.base-url=https://images.example.com/")
@AutoConfigureMockMvc
class ProductControllerTests {

    @Autowired
    private MockMvc mockMvc;

    // Fake Data API: no real service or database needed
    @MockitoBean
    private DataApiClient dataApiClient;

    private static Product mouse() {
        return new Product(1, "Wireless Mouse", "Electronics", new BigDecimal("1599.00"), "products/wireless-mouse.webp");
    }

    @Test
    void paged_returnsItemsTotalsAndFullImageUrl() throws Exception {
        when(dataApiClient.getProductsPage(2, 24, "mouse", "Electronics", "price-asc"))
                .thenReturn(new PagedProducts(List.of(mouse()), 2, 24, 25, 2));

        mockMvc.perform(get("/products/paged?page=2&pageSize=24&search=mouse&category=Electronics&sort=price-asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(25))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Wireless Mouse"))
                .andExpect(jsonPath("$.items[0].imageUrl").value("https://images.example.com/products/wireless-mouse.webp"));
    }

    @Test
    void paged_dataApiDown_returns503() throws Exception {
        when(dataApiClient.getProductsPage(1, 24, null, null, null))
                .thenThrow(new ResourceAccessException("Connection refused"));

        mockMvc.perform(get("/products/paged"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void productById_returnsProduct() throws Exception {
        when(dataApiClient.getProduct(1)).thenReturn(mouse());

        mockMvc.perform(get("/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Wireless Mouse"))
                .andExpect(jsonPath("$.imageUrl").value("https://images.example.com/products/wireless-mouse.webp"));
    }

    @Test
    void productById_unknownId_returns404() throws Exception {
        when(dataApiClient.getProduct(999))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null));

        mockMvc.perform(get("/products/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void categories_returnsList() throws Exception {
        when(dataApiClient.getCategories()).thenReturn(List.of("Beauty", "Books"));

        mockMvc.perform(get("/products/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("Beauty"));
    }
}
