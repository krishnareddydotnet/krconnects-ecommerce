using DataApi.Data;
using DataApi.Models;
using DataApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DataApi.Tests;

/// <summary>
/// Tests the product CRUD logic using an in-memory database.
/// </summary>
public class ProductServiceTests
{
    // Creates a service with a fresh database that already has the 500 demo products
    private static ProductService CreateServiceWithSeedData()
    {
        var options = new DbContextOptionsBuilder<DataDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var db = new DataDbContext(options);
        db.Products.AddRange(ProductSeedData.GetProducts());
        db.SaveChanges();

        return new ProductService(db);
    }

    [Fact]
    public void SeedData_Has500Products()
    {
        Assert.Equal(500, ProductSeedData.GetProducts().Count);
    }

    [Fact]
    public async Task GetAll_NoSearch_Returns500Products()
    {
        var service = CreateServiceWithSeedData();

        var products = await service.GetAllAsync(null);

        Assert.Equal(500, products.Count);
    }

    [Fact]
    public async Task GetAll_SearchByCategory_ReturnsOnlyMatches()
    {
        var service = CreateServiceWithSeedData();

        var products = await service.GetAllAsync("Clothing");

        Assert.Equal(50, products.Count);
        Assert.All(products, p => Assert.Equal("Clothing", p.Category));
    }

    [Fact]
    public async Task Create_AddsProduct()
    {
        var service = CreateServiceWithSeedData();

        var created = await service.CreateAsync(new ProductRequest { Name = "Laptop Stand", Category = "Office", Price = 999m });
        var found = await service.GetByIdAsync(created.Id);

        Assert.NotNull(found);
        Assert.Equal("Laptop Stand", found!.Name);
    }

    [Fact]
    public async Task Update_ChangesPrice()
    {
        var service = CreateServiceWithSeedData();

        bool updated = await service.UpdateAsync(1, new ProductRequest { Name = "Wireless Mouse", Category = "Electronics", Price = 1299m });
        var product = await service.GetByIdAsync(1);

        Assert.True(updated);
        Assert.Equal(1299m, product!.Price);
    }

    [Fact]
    public async Task Delete_UnknownId_ReturnsFalse()
    {
        var service = CreateServiceWithSeedData();

        bool deleted = await service.DeleteAsync(9999);

        Assert.False(deleted);
    }

    // ----- Paging -----

    [Fact]
    public void SeedData_NamesAndImagePathsAreUnique()
    {
        var products = ProductSeedData.GetProducts();

        Assert.Equal(products.Count, products.Select(p => p.Name).Distinct().Count());
        Assert.Equal(products.Count, products.Select(p => p.ImageUrl).Distinct().Count());
        Assert.Equal("products/rubik-s-cube.webp", ProductSeedData.ImagePath("Rubik's Cube"));
    }

    [Fact]
    public async Task GetPage_FirstPage_Returns24ItemsAndTotals()
    {
        var service = CreateServiceWithSeedData();

        var result = await service.GetPageAsync(1, 24, null, null, null);

        Assert.Equal(24, result.Items.Count);
        Assert.Equal(500, result.TotalCount);
        Assert.Equal(21, result.TotalPages);          // 500 / 24 = 20.8 -> 21 pages
        Assert.Equal("Wireless Mouse", result.Items[0].Name);
    }

    [Fact]
    public async Task GetPage_LastPage_ReturnsRemainingItems()
    {
        var service = CreateServiceWithSeedData();

        var result = await service.GetPageAsync(21, 24, null, null, null);

        Assert.Equal(20, result.Items.Count);         // 500 - 20 x 24 = 20
    }

    [Fact]
    public async Task GetPage_Category_FiltersAndCounts()
    {
        var service = CreateServiceWithSeedData();

        var result = await service.GetPageAsync(1, 24, null, "Books", null);

        Assert.Equal(50, result.TotalCount);
        Assert.All(result.Items, p => Assert.Equal("Books", p.Category));
    }

    [Fact]
    public async Task GetPage_SortByPriceAsc_CheapestFirst()
    {
        var service = CreateServiceWithSeedData();

        var result = await service.GetPageAsync(1, 10, null, null, "price-asc");

        Assert.True(result.Items[0].Price <= result.Items[9].Price);
    }

    [Fact]
    public async Task GetPage_BadValues_AreCorrected()
    {
        var service = CreateServiceWithSeedData();

        var result = await service.GetPageAsync(0, 1000, null, null, null);   // page 0, pageSize 1000

        Assert.Equal(1, result.Page);
        Assert.Equal(100, result.PageSize);                                  // max 100 per page
    }

    [Fact]
    public async Task GetCategories_Returns10SortedCategories()
    {
        var service = CreateServiceWithSeedData();

        var categories = await service.GetCategoriesAsync();

        Assert.Equal(10, categories.Count);
        Assert.Equal("Beauty", categories[0]);
    }
}
