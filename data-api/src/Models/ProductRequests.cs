using System.ComponentModel.DataAnnotations;

namespace DataApi.Models;

// Request body for creating OR updating a product.
// Invalid input (missing name, negative price...) returns 400 automatically.
public class ProductRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [Required]
    [StringLength(50, MinimumLength = 2)]
    public string Category { get; set; } = "";

    [Range(typeof(decimal), "0", "10000000")]
    public decimal Price { get; set; }

    // Optional image path, e.g. "products/laptop-stand.webp"
    [StringLength(200)]
    public string? ImageUrl { get; set; }
}
