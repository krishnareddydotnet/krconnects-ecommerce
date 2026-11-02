package com.krconnects.catalog.controller;

import com.krconnects.catalog.service.DataApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Without Jwt__Key the app still starts: public endpoints work and every
 * admin request gets 401 (no token can be checked).
 */
@SpringBootTest(properties = "krconnects.jwt.key=")
@AutoConfigureMockMvc
class AdminWithoutJwtKeyTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DataApiClient dataApiClient;

    @Test
    void adminRequest_returns401() throws Exception {
        mockMvc.perform(delete("/admin/products/1").header("Authorization", "Bearer any.token.here"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void healthStillWorks() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk());
    }
}
