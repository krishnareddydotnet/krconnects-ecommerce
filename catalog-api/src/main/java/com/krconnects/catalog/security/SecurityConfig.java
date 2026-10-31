package com.krconnects.catalog.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Security for catalog-api.
 *
 *   /admin/**   -> needs a valid login token from auth-api AND role "admin"
 *                  no token / invalid token -> 401, valid but not admin -> 403
 *   everything else (public product endpoints, health) -> open, unchanged
 *
 * The token is checked with the SAME rules as auth-api and order-api:
 *   HS256 signature with the shared key (env Jwt__Key), issuer, audience, expiry.
 */
@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    // HS256 needs a key of at least 256 bits = 32 bytes (auth-api has the same rule)
    private static final int MIN_KEY_BYTES = 32;

    /**
     * Chain 1: ONLY for /admin/**. Checks the Bearer token and the role.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain adminSecurity(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        http
                .securityMatcher("/admin/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("admin"))
                // "Resource server" = check the "Authorization: Bearer <token>" header
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(roleFromRoleClaim())))
                // An API with tokens has no login session and no cookies, so:
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable());   // CSRF attacks need cookies; we use a header token
        return http.build();
    }

    /**
     * Chain 2: everything else stays public, exactly as before security was added.
     */
    @Bean
    @Order(2)
    public SecurityFilterChain publicEndpoints(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable());
        return http.build();
    }

    /**
     * Turns the token's "role" claim ("admin" / "customer") into a Spring role
     * ("ROLE_admin"), so hasRole("admin") above works.
     */
    private JwtAuthenticationConverter roleFromRoleClaim() {
        JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName("role");
        roles.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(roles);
        return converter;
    }

    /**
     * Checks a token: signature (HS256 + shared key), issuer, audience and expiry.
     */
    @Bean
    public JwtDecoder jwtDecoder(@Value("${krconnects.jwt.key:}") String key,
                                 @Value("${krconnects.jwt.issuer}") String issuer,
                                 @Value("${krconnects.jwt.audience}") String audience) {
        byte[] keyBytes = key.getBytes(StandardCharsets.UTF_8);

        // No (usable) key -> reject every token with 401, but keep the app running,
        // so the public product endpoints still work.
        if (keyBytes.length < MIN_KEY_BYTES) {
            log.warn("Jwt__Key is not set (or shorter than 32 characters). All /admin requests will get 401.");
            return token -> {
                throw new BadJwtException("No signing key configured");
            };
        }

        SecretKey secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)   // only HS256: blocks algorithm-swap tricks
                .build();

        // Default validators check expiry ("exp", 60 seconds clock skew, like auth-api)
        // plus our issuer. We add the audience check ourselves.
        OAuth2TokenValidator<Jwt> issuerAndExpiry = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> audienceCheck = new JwtClaimValidator<List<String>>(
                JwtClaimNames.AUD,
                audiences -> audiences != null && audiences.contains(audience));

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerAndExpiry, audienceCheck));
        return decoder;
    }
}
