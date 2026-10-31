package com.krconnects.catalog.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Turns bad admin input into a 400 with a clear message, e.g.
 *   { "message": "name is required; price must be more than 0" }
 * Only applies to AdminProductController, so the public endpoints behave exactly as before.
 */
@RestControllerAdvice(assignableTypes = AdminProductController.class)
public class AdminErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> invalidInput(MethodArgumentNotValidException ex) {
        List<String> problems = new ArrayList<>();
        for (ObjectError error : ex.getBindingResult().getAllErrors()) {
            problems.add(error.getDefaultMessage());
        }
        // Sorted, so the message is the same every time (easier to read and test)
        problems.sort(null);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", String.join("; ", problems)));
    }

    // Broken JSON, or text where a number is expected
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Request body must be valid JSON."));
    }
}
