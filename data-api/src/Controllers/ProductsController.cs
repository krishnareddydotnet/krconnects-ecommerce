using DataApi.Models;
using DataApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataApi.Controllers;

/// <summary>
/// CRUD endpoints for products.
///   GET    /products               -> list all products
///   GET    /products?search=desk   -> list products whose name or category contains "desk"
///   GET    /products/paged?page=1&pageSize=24&search=&category=&sort=
///                                  -> one page of products + total count
///   GET    /products/categories    -> list of categories
///   GET    /products/{id}          -> one product
///   POST   /products               -> create product
///   PUT    /products/{id}          -> update product
///   DELETE /products/{id}          -> delete product
/// </summary>
[ApiController]
[Route("products")]
public class ProductsController : ControllerBase
{
    private readonly ProductService _productService;

    public ProductsController(ProductService productService)
    {
        _productService = productService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
    {
        var products = await _productService.GetAllAsync(search);
        return Ok(products);
    }

    // sort: featured (default) | price-asc | price-desc | name-asc
    [HttpGet("paged")]
    public async Task<IActionResult> GetPage(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sort = null)
    {
        var result = await _productService.GetPageAsync(page, pageSize, search, category, sort);
        return Ok(result);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _productService.GetCategoriesAsync();
        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _productService.GetByIdAsync(id);
        if (product == null)
        {
            return NotFound(new { message = $"Product {id} not found." });
        }

        return Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Create(ProductRequest request)
    {
        var product = await _productService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);   // 201
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ProductRequest request)
    {
        bool updated = await _productService.UpdateAsync(id, request);
        if (!updated)
        {
            return NotFound(new { message = $"Product {id} not found." });
        }

        return NoContent();   // 204
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        bool deleted = await _productService.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound(new { message = $"Product {id} not found." });
        }

        return NoContent();
    }
}
