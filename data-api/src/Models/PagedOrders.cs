namespace DataApi.Models;

/// <summary>
/// One page of orders, returned by GET /orders?page=1&amp;pageSize=20 (admin list).
///   Items      -> the orders on this page (newest first, with their items)
///   TotalCount -> how many orders there are in total (all pages)
///   TotalPages -> how many pages there are
/// </summary>
public class PagedOrders
{
    public List<Order> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
