using DataApi.Data;
using DataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DataApi.Services;

/// <summary>
/// All database logic (CRUD) for products lives here.
/// </summary>
public class ProductService
{
    private readonly DataDbContext _db;

    public ProductService(DataDbContext db)
    {
        _db = db;
    }

    // READ: all products, optionally filtered by a search text (name or category)
    public async Task<List<Product>> GetAllAsync(string? search)
    {
        var query = _db.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            string text = search.Trim();
            query = query.Where(p => p.Name.Contains(text) || p.Category.Contains(text));
        }

        return await query.OrderBy(p => p.Id).ToListAsync();
    }

    // READ: one PAGE of products, with optional search, category and sort.
    // Only the rows for this page are read from the database (OFFSET / FETCH in SQL).
    public async Task<PagedProducts> GetPageAsync(int page, int pageSize, string? search, string? category, string? sort)
    {
        // Keep the numbers sensible: page >= 1, pageSize between 1 and 100
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Products.AsQueryable();

        // 1. Filter
        if (!string.IsNullOrWhiteSpace(category) && category != "All")
        {
            query = query.Where(p => p.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            string text = search.Trim();
            query = query.Where(p => p.Name.Contains(text) || p.Category.Contains(text));
        }

        // 2. Count ALL matching products (before taking one page)
        int totalCount = await query.CountAsync();

        // 3. Sort (default "featured" = by Id). ThenBy(Id) keeps the order stable between pages.
        query = sort switch
        {
            "price-asc"  => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price-desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "name-asc"   => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            _            => query.OrderBy(p => p.Id)
        };

        // 4. Take only this page: skip the earlier pages, take pageSize rows
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedProducts
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }

    // READ: the list of categories, e.g. ["Beauty", "Books", ...]
    public async Task<List<string>> GetCategoriesAsync()
    {
        return await _db.Products
            .Select(p => p.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
    }

    // READ: one product by id (null if not found)
    public async Task<Product?> GetByIdAsync(int id)
    {
        return await _db.Products.FindAsync(id);
    }

    // CREATE
    public async Task<Product> CreateAsync(ProductRequest request)
    {
        var product = new Product
        {
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            Price = request.Price,
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim()
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();   // INSERT happens here
        return product;
    }

    // UPDATE (false if not found)
    public async Task<bool> UpdateAsync(int id, ProductRequest request)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null)
        {
            return false;
        }

        product.Name = request.Name.Trim();
        product.Category = request.Category.Trim();
        product.Price = request.Price;
        product.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();

        await _db.SaveChangesAsync();   // UPDATE happens here
        return true;
    }

    // DELETE (false if not found)
    public async Task<bool> DeleteAsync(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null)
        {
            return false;
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();   // DELETE happens here
        return true;
    }
}
