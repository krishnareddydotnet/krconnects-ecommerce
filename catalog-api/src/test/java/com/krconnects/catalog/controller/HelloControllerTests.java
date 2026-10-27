package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.service.DataApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class HelloControllerTests {

    @Autowired
    private MockMvc mockMvc;

    // Replace the real Data API client with a fake one, so tests don't need
    // a running Data API or database.
    @MockitoBean
    private DataApiClient dataApiClient;

    @Test
    void root_returnsOk() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk());
    }

    @Test
    void root_containsServiceName() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("krconnects-catalog-api")));
    }

    @Test
    void hello_returnsOk() throws Exception {
        mockMvc.perform(get("/hello"))
                .andExpect(status().isOk());
    }

    @Test
    void hello_containsTimestamp() throws Exception {
        mockMvc.perform(get("/hello"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("timestamp")));
    }

    @Test
    void products_returnsProductsFromDataApi() throws Exception {
        when(dataApiClient.getProducts()).thenReturn(List.of(
                new Product(1, "Wireless Mouse", "Electronics", new BigDecimal("1599.00"))
        ));

        mockMvc.perform(get("/products"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Wireless Mouse")));
    }

    @Test
    void products_dataApiDown_returns503() throws Exception {
        when(dataApiClient.getProducts()).thenThrow(new ResourceAccessException("Connection refused"));

        mockMvc.perform(get("/products"))
                .andExpect(status().isServiceUnavailable());
    }
}
