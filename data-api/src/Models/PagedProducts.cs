namespace DataApi.Models;

/// <summary>
/// One page of products, returned by GET /products/paged.
///   Items      -> the products on this page
///   TotalCount -> how many products match in total (all pages)
///   TotalPages -> how many pages there are, so the UI can show 1, 2, 3 ...
/// </summary>
public class PagedProducts
{
    public List<Product> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
