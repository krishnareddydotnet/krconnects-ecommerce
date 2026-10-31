package com.krconnects.catalog.controller;

import com.krconnects.catalog.model.Product;
import com.krconnects.catalog.model.ProductRequest;
import com.krconnects.catalog.service.DataApiClient;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for /admin/products: who may call it (401 / 403 / OK) and input validation.
 * Tokens are made here, like auth-api makes them, with a test-only key.
 */
@SpringBootTest(properties = "krconnects.jwt.key=" + AdminProductControllerTests.TEST_KEY)
@AutoConfigureMockMvc
class AdminProductControllerTests {

    // Test-only signing key (64 x 'k'), clearly not a real secret (same idea as auth-api's tests)
    static final String TEST_KEY = "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk";

    private static final String VALID_BODY =
            "{\"name\":\"Laptop Stand\",\"category\":\"Office\",\"price\":999.50,\"imageUrl\":\"products/laptop-stand.webp\"}";

    @Autowired
    private MockMvc mockMvc;

    // Fake Data API: no real service or database needed
    @MockitoBean
    private DataApiClient dataApiClient;

    // ----- Token helpers -----

    // A token like auth-api creates. Each argument can be changed to break one rule.
    private static String token(String role, String key, String issuer, String audience, Instant expires) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("1")
                .claim("name", "krishna")
                .claim("role", role)
                .issuer(issuer)
                .audience(audience)
                .issueTime(new Date())
                .expirationTime(Date.from(expires))
                .build();

        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(key.getBytes()));
        return jwt.serialize();
    }

    private static String bearer(String role) throws Exception {
        String jwt = token(role, TEST_KEY, "krconnects-auth-api", "krconnects-customer-portal",
                Instant.now().plusSeconds(3600));
        return "Bearer " + jwt;
    }

    private static Product saved() {
        return new Product(501, "Laptop Stand", "Office", new BigDecimal("999.50"), "products/laptop-stand.webp");
    }

    // ----- 401: no or bad token -----

    @Test
    void create_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/admin/products").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());

        verify(dataApiClient, never()).createProduct(any());
    }

    @Test
    void create_tokenSignedWithOtherKey_returns401() throws Exception {
        String otherKey = "o".repeat(64);
        String jwt = token("admin", otherKey, "krconnects-auth-api", "krconnects-customer-portal", Instant.now().plusSeconds(3600));

        mockMvc.perform(post("/admin/products").header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void create_expiredToken_returns401() throws Exception {
        String jwt = token("admin", TEST_KEY, "krconnects-auth-api", "krconnects-customer-portal",
                Instant.now().minusSeconds(600));   // expired 10 minutes ago

        mockMvc.perform(post("/admin/products").header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void create_wrongIssuer_returns401() throws Exception {
        String jwt = token("admin", TEST_KEY, "someone-else", "krconnects-customer-portal", Instant.now().plusSeconds(3600));

        mockMvc.perform(post("/admin/products").header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void create_wrongAudience_returns401() throws Exception {
        String jwt = token("admin", TEST_KEY, "krconnects-auth-api", "another-app", Instant.now().plusSeconds(3600));

        mockMvc.perform(post("/admin/products").header("Authorization", "Bearer " + jwt)
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    // ----- 403: valid token, but not an admin -----

    @Test
    void create_customerToken_returns403() throws Exception {
        mockMvc.perform(post("/admin/products").header("Authorization", bearer("customer"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isForbidden());

        verify(dataApiClient, never()).createProduct(any());
    }

    @Test
    void delete_customerToken_returns403() throws Exception {
        mockMvc.perform(delete("/admin/products/1").header("Authorization", bearer("customer")))
                .andExpect(status().isForbidden());

        verify(dataApiClient, never()).deleteProduct(1);
    }

    // ----- Success (admin) -----

    @Test
    void create_admin_returns201AndCallsDataApi() throws Exception {
        when(dataApiClient.createProduct(any())).thenReturn(saved());

        mockMvc.perform(post("/admin/products").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(501))
                .andExpect(jsonPath("$.name").value("Laptop Stand"));

        verify(dataApiClient).createProduct(argThat(request ->
                request.getName().equals("Laptop Stand") && request.getPrice().compareTo(new BigDecimal("999.50")) == 0));
    }

    @Test
    void create_admin_trimsTextAndStoresEmptyImageAsNull() throws Exception {
        when(dataApiClient.createProduct(any())).thenReturn(saved());
        String body = "{\"name\":\"  Laptop Stand  \",\"category\":\" Office \",\"price\":10,\"imageUrl\":\"  \"}";

        mockMvc.perform(post("/admin/products").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        verify(dataApiClient).createProduct(argThat(request ->
                request.getName().equals("Laptop Stand") && request.getCategory().equals("Office") && request.getImageUrl() == null));
    }

    @Test
    void update_admin_returns204() throws Exception {
        mockMvc.perform(put("/admin/products/5").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isNoContent());

        verify(dataApiClient).updateProduct(eq(5), any(ProductRequest.class));
    }

    @Test
    void update_unknownProduct_returns404() throws Exception {
        doThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null))
                .when(dataApiClient).updateProduct(eq(999), any());

        mockMvc.perform(put("/admin/products/999").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_admin_returns204() throws Exception {
        mockMvc.perform(delete("/admin/products/5").header("Authorization", bearer("admin")))
                .andExpect(status().isNoContent());

        verify(dataApiClient).deleteProduct(5);
    }

    @Test
    void getForEdit_admin_returnsImagePathNotFullUrl() throws Exception {
        when(dataApiClient.getProduct(501)).thenReturn(saved());

        mockMvc.perform(get("/admin/products/501").header("Authorization", bearer("admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").value("products/laptop-stand.webp"));
    }

    @Test
    void create_dataApiDown_returns503() throws Exception {
        when(dataApiClient.createProduct(any())).thenThrow(new ResourceAccessException("Connection refused"));

        mockMvc.perform(post("/admin/products").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isServiceUnavailable());
    }

    // ----- Validation (400) -----

    private void expectBadRequest(String body, String expectedMessagePart) throws Exception {
        mockMvc.perform(post("/admin/products").header("Authorization", bearer("admin"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(expectedMessagePart)));

        verify(dataApiClient, never()).createProduct(any());
    }

    @Test
    void create_missingName_returns400() throws Exception {
        expectBadRequest("{\"category\":\"Office\",\"price\":10}", "name is required");
    }

    @Test
    void create_missingCategory_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"  \",\"price\":10}", "category is required");
    }

    @Test
    void create_priceZero_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"Office\",\"price\":0}", "price must be more than 0");
    }

    @Test
    void create_priceOneMillion_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"Office\",\"price\":1000000}", "price must be less than 1,000,000");
    }

    @Test
    void create_priceMissing_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"Office\"}", "price is required");
    }

    @Test
    void create_imageFullUrl_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"Office\",\"price\":10,\"imageUrl\":\"https://evil.example.com/x.webp\"}",
                "imageUrl must be a relative path");
    }

    @Test
    void create_imagePathGoingUp_returns400() throws Exception {
        expectBadRequest("{\"name\":\"Pen\",\"category\":\"Office\",\"price\":10,\"imageUrl\":\"products/../secret\"}",
                "imageUrl must be a relative path");
    }

    @Test
    void create_brokenJson_returns400() throws Exception {
        expectBadRequest("{ not json", "valid JSON");
    }

    // ----- Public endpoints stay public -----

    @Test
    void publicProduct_withoutToken_stillWorks() throws Exception {
        when(dataApiClient.getProduct(1)).thenReturn(saved());

        mockMvc.perform(get("/products/1"))
                .andExpect(status().isOk());
    }

    @Test
    void publicProduct_withGarbageToken_isNotRejected() throws Exception {
        // Security only runs on /admin/**, so a stray header can't break the public site
        when(dataApiClient.getProduct(1)).thenReturn(saved());

        mockMvc.perform(get("/products/1").header("Authorization", "Bearer garbage"))
                .andExpect(status().isOk());
    }
}
