namespace DataApi.Models;

/// <summary>
/// One row in the "Orders" table. The lines of the order are in OrderItems.
/// Prices and totals are calculated by order-api (from the Products table),
/// the Data API only stores them.
/// </summary>
public class Order
{
    public int Id { get; set; }                       // primary key (auto number)
    public string OrderNumber { get; set; } = "";     // e.g. "KRC-20261031-7QX2PA", unique
    public int UserId { get; set; }                   // who placed the order (from the login token)
    public string Username { get; set; } = "";        // copy of the name, so we don't need a join to show it
    public string Status { get; set; } = "";          // e.g. "Placed"
    public decimal Subtotal { get; set; }             // sum of all line totals (INR)
    public decimal Delivery { get; set; }             // delivery fee (0 = free)
    public decimal Total { get; set; }                // Subtotal + Delivery
    public DateTime CreatedAt { get; set; }           // when the order was placed (UTC)

    // The lines of this order (one per product)
    public List<OrderItem> Items { get; set; } = new();
}
