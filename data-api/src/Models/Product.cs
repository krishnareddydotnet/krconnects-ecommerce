namespace DataApi.Models;

/// <summary>
/// One row in the "Products" table.
/// </summary>
public class Product
{
    public int Id { get; set; }                 // primary key (auto number)
    public string Name { get; set; } = "";      // e.g. "Wireless Mouse"
    public string Category { get; set; } = "";  // e.g. "Electronics"
    public decimal Price { get; set; }          // demo price in INR

    // Image PATH only, e.g. "products/wireless-mouse.webp" (null = no image).
    // The base URL (Blob Storage / Front Door) is added by catalog-api.
    public string? ImageUrl { get; set; }
}
